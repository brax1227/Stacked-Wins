import SwiftUI

/// "Too big" -- the reason the pile froze them. Break the card into pieces
/// and the first piece becomes the next card.
///
/// Three ways to fill the box, in descending order of how much they ask of
/// someone who is already stuck:
///
/// 1. **Just 5 minutes.** One tap, no typing, no model, no thinking about the
///    task at all. Always available, always smaller than what it replaces.
/// 2. **An opener.** A physical stem you finish with one word. A blank with a
///    beginning is a different thing from a blank.
/// 3. **The model**, on phones that have one, which can actually read the card.
///
/// Before this, a phone without Apple Intelligence got only an empty editor
/// and the question "what's the smallest first piece?" -- which is the thing
/// the user came here unable to answer. 1 and 2 are the fallback, and they
/// need nothing but a phone.
///
/// Every one of them only ever fills the box. Nothing reaches the stack until
/// the user taps "Break it up" themselves.
struct BreakItUpSheet: View {
    let item: StackItem
    @ObservedObject var model: NowViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var pieces = ""
    @State private var isSuggesting = false
    @State private var suggestFailed = false
    @FocusState private var editorFocused: Bool

    private var canSplit: Bool {
        !pieces.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isBusy
    }

    /// nil when the card is already a timebox, so the button hides rather
    /// than offering to wrap it twice.
    private var timeboxStep: String? {
        ManualFirstStep.timebox(item.title)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title)
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)

                Text("What's the smallest first piece? One per line.")
                    .font(.headline)

                TextEditor(text: $pieces)
                    .focused($editorFocused)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .padding(12)
                    .frame(minHeight: 120)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .topLeading) {
                        if pieces.isEmpty {
                            Text("find the phone number\nwrite down what to ask\nmake the call")
                                .foregroundStyle(.tertiary)
                                .padding(20)
                                .allowsHitTesting(false)
                        }
                    }
                    .accessibilityIdentifier("pieces-editor")

                helpers

                if suggestFailed {
                    Text("Couldn't come up with steps for that one. Try \u{201C}Just 5 minutes\u{201D} \u{2014} it works for anything.")
                        .accessibilityIdentifier("suggest-failed")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 8)

                Button {
                    // The only thing in this sheet that changes the stack.
                    model.split(pieces: pieces)
                    dismiss()
                } label: {
                    Text("Break it up")
                        .font(.title3.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!canSplit)
                .accessibilityIdentifier("confirm-split")
            }
            .padding(24)
            .navigationTitle("Break it up")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Never mind") { dismiss() }
                }
            }
            .onAppear { editorFocused = true }
        }
    }

    // MARK: - Ways to fill the box

    @ViewBuilder
    private var helpers: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                // The zero-thought option. First, because it asks least.
                if let timeboxStep {
                    Button {
                        pieces = timeboxStep
                        editorFocused = true
                    } label: {
                        Label("Just 5 minutes", systemImage: "timer")
                            .font(.footnote.weight(.medium))
                    }
                    .buttonStyle(.bordered)
                    .disabled(model.isBusy)
                    .accessibilityIdentifier("timebox")
                }

                // Only where the phone actually has a model.
                if model.capabilities.splitAssist {
                    Button {
                        suggest()
                    } label: {
                        if isSuggesting {
                            Label("Thinking…", systemImage: "sparkles")
                                .font(.footnote.weight(.medium))
                        } else {
                            Label("Suggest steps", systemImage: "sparkles")
                                .font(.footnote.weight(.medium))
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSuggesting || model.isBusy)
                    .accessibilityIdentifier("suggest")
                }
            }

            Text("or start a line with")
                .font(.caption)
                .foregroundStyle(.tertiary)

            // Stems, not sentences. Tapping one writes the beginning and
            // leaves the caret in the blank.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ManualFirstStep.openers) { opener in
                        Button {
                            pieces = ManualFirstStep.insert(opener, into: pieces)
                            editorFocused = true
                        } label: {
                            Text(opener.label)
                                .font(.footnote)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Color(.secondarySystemBackground), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isBusy)
                        .accessibilityIdentifier("opener-\(opener.id)")
                    }
                }
                .padding(.horizontal, 1)
            }
        }
    }

    private func suggest() {
        isSuggesting = true
        suggestFailed = false
        Task {
            defer { isSuggesting = false }
            do {
                let suggested = try await model.suggestPieces()
                if suggested.isEmpty {
                    suggestFailed = true
                } else {
                    pieces = suggested.joined(separator: "\n")
                }
            } catch {
                suggestFailed = true
            }
        }
    }
}
