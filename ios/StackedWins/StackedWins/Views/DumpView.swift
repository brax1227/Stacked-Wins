import SwiftUI

/// The brain dump. Job 1: get it out of the head.
///
/// One box, one thing per line, no due dates, no priorities, no estimates.
/// The lane toggle is the single exception and it's cheap on purpose: one
/// choice for the whole dump rather than one per item, and it defaults, so it
/// can be ignored entirely. See PROBLEM.md.
struct DumpView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @State private var kind: StackKind
    @State private var isSaving = false
    @State private var errorMessage: String?
    @FocusState private var editorFocused: Bool

    /// Opens empty from the + button, or already holding whatever a link,
    /// a Shortcut or a share handed over.
    init(startingWith text: String = "", in kind: StackKind = .need) {
        _text = State(initialValue: text)
        _kind = State(initialValue: kind)
    }

    private var lineCount: Int {
        text.split(whereSeparator: \.isNewline)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .count
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("Everything you're carrying, one per line. Don't rank it, don't finish the thought. You'll only ever see one of these at a time.")
                    .foregroundStyle(.secondary)

                // One choice for the whole dump, not one per line. Dump your
                // needs, flip the switch, dump your wants.
                Picker("Lane", selection: $kind) {
                    ForEach(StackKind.allCases) { lane in
                        Text(lane.label).tag(lane)
                    }
                }
                .pickerStyle(.segmented)

                Text(kind.blurb)
                    .font(.footnote)
                    .foregroundStyle(.tertiary)

                TextEditor(text: $text)
                    .focused($editorFocused)
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .padding(12)
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(alignment: .topLeading) {
                        if text.isEmpty {
                            Text("call the bank\nlaundry\nemail my advisor back\nthat thing I keep forgetting")
                                .foregroundStyle(.tertiary)
                                .padding(20)
                                .allowsHitTesting(false)
                        }
                    }

                HStack {
                    Text(lineCount == 0
                         ? "One thing per line."
                         : "\(lineCount) \(lineCount == 1 ? "thing" : "things") — out of your head.")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }

                if let errorMessage {
                    Text("\(errorMessage) Your text is still here — try again.")
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                Button {
                    save()
                } label: {
                    Group {
                        if isSaving {
                            ProgressView().tint(.white)
                        } else {
                            Text("Put it down")
                                .font(.title3.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(lineCount == 0 || isSaving)
            }
            .padding(24)
            .navigationTitle("Put it all down here.")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { editorFocused = true }
            .onAppear {
                // Arrived with something in it: leave room to add another
                // line rather than making the user tap to the end first.
                if !text.isEmpty && !text.hasSuffix("\n") { text += "\n" }
            }
        }
    }

    private func save() {
        isSaving = true
        errorMessage = nil
        let payload = text
        let lane = kind
        Task {
            defer { isSaving = false }
            do {
                _ = try await StackService.dump(payload, into: lane)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
