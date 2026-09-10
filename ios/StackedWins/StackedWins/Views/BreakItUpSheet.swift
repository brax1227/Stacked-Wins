import SwiftUI

/// "Too big" -- the reason the pile froze them. Break the card into pieces
/// and the first piece becomes the next card.
///
/// The suggest button only ever SUGGESTS: pieces land in the editable box and
/// nothing is written until the user taps "Break it up" themselves. It runs
/// on the phone's own model, so the thing you're avoiding never leaves the
/// device -- and it only appears at all on phones that have one.
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

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title)
                    .font(.title3)
                    .foregroundStyle(.secondary)

                Text("What's the smallest first piece? One per line.")
                    .font(.headline)

                TextEditor(text: $pieces)
                    .focused($editorFocused)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .padding(12)
                    .frame(minHeight: 160)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .topLeading) {
                        if pieces.isEmpty {
                            Text("find the phone number\nwrite down what to ask\nmake the call")
                                .foregroundStyle(.tertiary)
                                .padding(20)
                                .allowsHitTesting(false)
                        }
                    }

                if model.capabilities.splitAssist {
                    Button {
                        suggest()
                    } label: {
                        if isSuggesting {
                            Label("Thinking…", systemImage: "sparkles")
                        } else {
                            Label("I don't know where to start", systemImage: "sparkles")
                        }
                    }
                    .font(.footnote)
                    .disabled(isSuggesting || model.isBusy)
                }

                if suggestFailed {
                    Text("Couldn't come up with steps for that one. Break it up yourself — you know it better anyway.")
                        .accessibilityIdentifier("suggest-failed")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button {
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
