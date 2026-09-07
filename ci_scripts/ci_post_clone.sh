#!/bin/sh
# Xcode Cloud runs this before cloning dependencies and building.
#
# Why it is needed: StackedWins.xcodeproj is generated from project.yml by
# XcodeGen and is deliberately not committed (pbxproj files are unreviewable
# and conflict constantly). Xcode Cloud therefore has to generate it before
# there is anything to build.
#
# Xcode Cloud looks for this file at ci_scripts/ci_post_clone.sh relative to
# the repository root.

set -e

echo "--- Installing XcodeGen ---"
# Homebrew is preinstalled on Xcode Cloud runners.
brew install xcodegen

echo "--- Generating StackedWins.xcodeproj ---"
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
xcodegen generate --spec project.yml

echo "--- Done: project generated ---"
