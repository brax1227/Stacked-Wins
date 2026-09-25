#!/usr/bin/env bash
# Build and run the Foundation-only slice of the iOS app on Linux.
#
#   .claude/hooks/swift-test.sh            # run every test
#   .claude/hooks/swift-test.sh -v         # keep the full XCTest output
#
# WHY THIS EXISTS. The app is iOS and CI runs `xcodebuild test` on a macOS
# runner, which takes minutes and needs a Mac. Most of the logic worth testing
# -- the stack, the timebox and openers, the trial measurement -- is plain
# Foundation, so it compiles and runs here in about a second. This is the inner
# loop; the macOS run is still the check that counts, because SwiftUI,
# AppIntents and FoundationModels are not compiled here at all.
#
# It is a dev tool. Nothing in it ships: the Xcode project builds from
# ios/StackedWins/StackedWins and never looks in .claude/.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

SRC=ios/StackedWins/StackedWins
TESTS=ios/StackedWins/StackedWinsTests
BUILD=${TMPDIR:-/tmp}/stacked-wins-swifttest
VERBOSE=${1:-}

# Sources that need SwiftUI, UIKit, AppIntents or FoundationModels, none of
# which exist on Linux. Listed explicitly rather than pattern-matched so that
# adding a file to the app is a decision about this list too -- see the drift
# guard below.
EXCLUDED_SRCS="
$SRC/StackedWinsApp.swift
$SRC/AppState.swift
$SRC/CaptureRouter.swift
$SRC/Services/OnDeviceSplitAssist.swift
$SRC/Services/StackBackends.swift
$SRC/Utils/Haptics.swift
$SRC/Utils/Keychain.swift
"

MOD_SRCS=""
UNACCOUNTED=""
while IFS= read -r file; do
  case "$file" in
    "$SRC"/Views/*|"$SRC"/Intents/*) continue ;;
  esac
  if grep -qxF "$file" <<<"$(tr -s '[:space:]' '\n' <<<"$EXCLUDED_SRCS")"; then
    continue
  fi
  case "$file" in
    "$SRC"/Models/*|"$SRC"/Services/*|"$SRC"/Utils/*) MOD_SRCS="$MOD_SRCS $file" ;;
    *) UNACCOUNTED="$UNACCOUNTED $file" ;;
  esac
done < <(find "$SRC" -name '*.swift' | sort)

# A new file at the top level of the app is neither obviously Foundation-only
# nor obviously not. Stop rather than quietly leave it untested.
if [ -n "$UNACCOUNTED" ]; then
  echo "swift-test: these files are in neither list -- add them to EXCLUDED_SRCS" >&2
  echo "            or move them under Models/, Services/ or Utils/:" >&2
  for f in $UNACCOUNTED; do echo "              $f" >&2; done
  exit 2
fi

# Every test file is compiled. If one needs something Linux hasn't got, the
# build says so by name, which is more useful than a list that silently skips it.
TEST_SRCS=$(find "$TESTS" -name '*Tests.swift' | sort | tr '\n' ' ')

mkdir -p "$BUILD"

# XCTest on Linux has no test discovery: XCTMain needs every case listed. That
# list was maintained by hand and went stale twice -- new tests passed locally
# while never running. Generated from the sources instead, every run.
python3 - "$BUILD" $TEST_SRCS <<'PY'
import re, sys
from pathlib import Path

build, files = Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]
FUNC = re.compile(r'^\s*func\s+(test[A-Za-z0-9_]*)\s*\(\s*\)\s*(.*?)\{')
COND = re.compile(r'^\s*#(if|elseif|else|endif)\b\s*(.*)$')

# Conditions this build satisfies. Everything else -- os(iOS), canImport(UIKit),
# targetEnvironment(simulator), DEBUG (no -DDEBUG here) -- is false, so a test
# declared inside one is not compiled and must not be registered. An unfamiliar
# condition is treated as false and named, rather than guessed at.
TRUE_TOKENS = {'os(Linux)', 'canImport(Foundation)', 'canImport(XCTest)'}
FALSE_TOKENS = {
    'os(iOS)', 'os(macOS)', 'os(watchOS)', 'os(tvOS)', 'os(visionOS)',
    'canImport(UIKit)', 'canImport(SwiftUI)', 'canImport(FoundationModels)',
    'canImport(AppIntents)', 'targetEnvironment(simulator)', 'DEBUG',
}

def truth(condition, where):
    normalised = condition.strip()
    if normalised in TRUE_TOKENS:
        return True
    if any(normalised == f or normalised.startswith(f) for f in FALSE_TOKENS):
        return False
    print(f'swift-test: {where}: condition "{normalised}" is unknown here '
          f'-- treating it as false, so tests inside it are not run', file=sys.stderr)
    return False

lines = ['import XCTest', '@testable import StackedWins', '']
suites = []
total = 0
for path in files:
    suite = path.stem
    text = path.read_text().splitlines()
    if not any(f'class {suite}' in line for line in text):
        sys.exit(f'{path}: expected a class named {suite}')

    found, stack = [], []
    for number, line in enumerate(text, 1):
        directive = COND.match(line)
        if directive:
            kind, condition = directive.group(1), directive.group(2)
            where = f'{path}:{number}'
            if kind == 'if':
                stack.append(truth(condition, where))
            elif kind == 'elseif' and stack:
                stack[-1] = False if stack[-1] else truth(condition, where)
            elif kind == 'else' and stack:
                stack[-1] = not stack[-1]
            elif kind == 'endif' and stack:
                stack.pop()
            continue
        if not all(stack):
            continue
        match = FUNC.match(line)
        if match:
            found.append(match.groups())

    if not found:
        continue
    suites.append(suite)
    total += len(found)
    lines.append(f'extension {suite} {{')
    lines.append('    static var generatedTests = [')
    for name, tail in found:
        # `asyncTest` bridges an async test method into XCTest's sync runner;
        # a plain method is registered as itself.
        lines.append(f'        ("{name}", {"asyncTest(" + name + ")" if "async" in tail else name}),')
    lines.append('    ]')
    lines.append('}')
    lines.append('')

(build / 'Generated.swift').write_text('\n'.join(lines) + '\n')

# XCTMain is top-level code, and Swift allows that only in main.swift.
main = ['import XCTest', '', 'XCTMain([']
for suite in suites:
    main.append(f'    testCase({suite}.generatedTests),')
main += ['])', '']
(build / 'main.swift').write_text('\n'.join(main))
print(f'swift-test: {total} cases in {len(suites)} suites')
PY

swiftc -parse-as-library -emit-library -emit-module -module-name StackedWins \
  -enable-testing -module-link-name StackedWins \
  -o "$BUILD/libStackedWins.so" -emit-module-path "$BUILD/StackedWins.swiftmodule" \
  $MOD_SRCS

swiftc -I "$BUILD" -L "$BUILD" -lStackedWins -o "$BUILD/runtests" \
  $TEST_SRCS "$BUILD/Generated.swift" "$BUILD/main.swift"

SWIFT_LIB=$(dirname "$(dirname "$(command -v swiftc)")")/lib/swift/linux
if [ "$VERBOSE" = "-v" ]; then
  LD_LIBRARY_PATH="$BUILD:$SWIFT_LIB" "$BUILD/runtests"
else
  # Only the failures and the totals; the per-case chatter is thousands of lines.
  LD_LIBRARY_PATH="$BUILD:$SWIFT_LIB" "$BUILD/runtests" 2>&1 \
    | grep -E "error:|failed|Executed [0-9]+ tests" \
    | grep -v "^Test Case .* passed"
fi
