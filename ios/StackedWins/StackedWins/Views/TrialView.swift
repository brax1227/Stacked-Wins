import SwiftUI

/// What the app has recorded about how you use it, and the chance to read all
/// of it before deciding whether to send any.
///
/// Showing this to the user is the point, not a courtesy. The measurement is
/// defensible only because a person can open it, see that it is dates and
/// counts, and delete it. A trial that asks people to send data they can't
/// inspect is asking for trust it hasn't earned.
struct TrialView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var report: TrialReport?
    @State private var json = ""
    @State private var copied = false
    @State private var confirmingReset = false

    var body: some View {
        NavigationStack {
            List {
                if let report {
                    Section {
                        row("First opened", report.firstOpen ?? "not yet")
                        row("Started something", report.startEvidence.summary)
                        if let days = report.daysToFirstStart {
                            row("Took", days == 0 ? "the same day" : "\(days) day\(days == 1 ? "" : "s")")
                        }
                        row("Days used", "\(report.activeDays)")
                        row("Came back the week after",
                            report.returnedNextWeek ? "yes"
                                : report.nextWeekWindowComplete ? "no" : "too early to say")
                    } header: {
                        Text("This phone").textCase(nil)
                    } footer: {
                        Text(report.countsAsRealUser
                             ? "Counted as a real trial user."
                             : "Marked as test data — excluded from trial totals.")
                    }

                    Section {
                        row("Things put down", "\(report.totalCaptures)")
                        row("First steps picked", "\(report.totalBrokenDown)")
                        row("Things marked done", "\(report.totalStarted)")
                    } footer: {
                        // The correction, said plainly to the person it is
                        // about: the app can see that you picked a step, and
                        // cannot see whether you then did it.
                        Text("Picking a first step is a plan. Only \u{201C}marked done\u{201D} is the app seeing you finish something \u{2014} and even that it takes your word for. Neither number decides anything on its own.")
                    }
                }

                Section {
                    Text(json.isEmpty ? "Nothing recorded yet." : json)
                        .font(.caption.monospaced())
                        .textSelection(.enabled)
                } header: {
                    Text("Everything that is stored").textCase(nil)
                } footer: {
                    Text("Dates and counts. No task text, no identifiers, no times of day. It stays on this phone unless you send it.")
                }

                Section {
                    Button {
                        #if canImport(UIKit)
                        UIPasteboard.general.string = json
                        #endif
                        copied = true
                    } label: {
                        Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                    }
                    .disabled(json.isEmpty)

                    Button(role: .destructive) {
                        confirmingReset = true
                    } label: {
                        Label("Delete what's recorded", systemImage: "trash")
                    }
                    .disabled(json.isEmpty)
                }
            }
            .navigationTitle("Trial data")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .confirmationDialog("Delete what's recorded?",
                                isPresented: $confirmingReset, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        try? await ActivationLog.shared.reset()
                        await load()
                    }
                }
                Button("Keep it", role: .cancel) {}
            } message: {
                Text("Your stack is not touched. Only these counts go.")
            }
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
            Spacer(minLength: 12)
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
    }

    private func load() async {
        report = await ActivationLog.shared.report()
        json = await ActivationLog.shared.exportJSON()
        copied = false
    }
}
