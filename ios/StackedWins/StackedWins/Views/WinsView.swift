import SwiftUI

/// What you've actually cleared. The app is called Stacked Wins; this is the
/// stack of wins.
///
/// This is the one screen where a growing number is a good thing, so it's the
/// only place one appears. Everywhere else a count would be the size of the
/// pile leaking back in (PROBLEM.md); here it's the opposite -- evidence
/// against the feeling that nothing ever gets done, which is the feeling that
/// starts the freeze.
///
/// Nothing here is a streak. A streak turns a missed day into a punishment,
/// and a punishment is a reason to stop opening the app.
struct WinsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var wins: [StackItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    /// How far back to look. Two weeks is enough to see a good run without
    /// turning into an archive to scroll.
    private let daysBack = 14

    private var calendar: Calendar { .autoupdatingCurrent }

    private var today: [StackItem] {
        let start = calendar.startOfDay(for: Date())
        return wins.filter { ($0.completedDate ?? .distantPast) >= start }
    }

    /// One past day's worth of wins.
    private struct Day: Identifiable {
        let id: Date
        let items: [StackItem]
    }

    /// Everything before today, newest day first.
    private var earlier: [Day] {
        let start = calendar.startOfDay(for: Date())
        let older = wins.filter { ($0.completedDate ?? .distantPast) < start }
        let grouped = Dictionary(grouping: older) { item in
            calendar.startOfDay(for: item.completedDate ?? .distantPast)
        }
        return grouped.keys.sorted(by: >).map { Day(id: $0, items: grouped[$0] ?? []) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if let errorMessage {
                    ContentUnavailableView("Couldn't load your wins", systemImage: "wifi.exclamationmark",
                                           description: Text(errorMessage))
                } else if wins.isEmpty {
                    ContentUnavailableView {
                        Label("No wins yet", systemImage: "checkmark.circle")
                    } description: {
                        Text("Clear one card and it shows up here. The first one is the hard one.")
                    }
                } else {
                    List {
                        Section {
                            if today.isEmpty {
                                Text("Nothing yet today. That's allowed.")
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(today) { win in
                                    row(win)
                                }
                            }
                        } header: {
                            Text(today.isEmpty
                                 ? "Today"
                                 : "Today \u{2014} \(today.count) cleared")
                                .textCase(nil)
                        }

                        ForEach(earlier) { group in
                            Section {
                                ForEach(group.items) { win in
                                    row(win)
                                }
                            } header: {
                                Text("\(dayName(group.id)) \u{2014} \(group.items.count)")
                                    .textCase(nil)
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Wins")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func row(_ win: StackItem) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: "checkmark")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 16)
            Text(win.title)
            Spacer(minLength: 8)
            if let at = win.completedDate {
                Text(at, style: .time)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func dayName(_ day: Date) -> String {
        if calendar.isDateInYesterday(day) { return "Yesterday" }
        let formatter = DateFormatter()
        // Within the week, the weekday alone reads faster than a date.
        let daysAgo = calendar.dateComponents([.day], from: day, to: Date()).day ?? 0
        formatter.dateFormat = daysAgo < 7 ? "EEEE" : "EEEE, MMM d"
        return formatter.string(from: day)
    }

    private func load() async {
        isLoading = wins.isEmpty
        defer { isLoading = false }
        let since = calendar.date(byAdding: .day, value: -daysBack, to: calendar.startOfDay(for: Date()))
            ?? .distantPast
        do {
            wins = try await StackService.cleared(since: since)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
