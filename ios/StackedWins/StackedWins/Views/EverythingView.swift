import SwiftUI

/// The full list, per lane, and the only place ranking happens.
///
/// It's the user's data, so hiding it would be a lie -- but nothing opens
/// this on its own, and you never land here. Ranking is quarantined to this
/// screen on purpose: ranking is itself the thinking that freezes you, so
/// dump order is the default everywhere else and nothing ever blocks on it.
/// See PROBLEM.md.
struct EverythingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var kind: StackKind = .need
    @State private var list: StackList?
    @State private var isLoading = false
    @State private var isBusy = false
    @State private var errorMessage: String?

    private var items: [StackItem] { list?.items ?? [] }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && list == nil {
                    ProgressView()
                } else if items.isEmpty {
                    ContentUnavailableView(
                        "Nothing in this lane",
                        systemImage: "tray",
                        description: Text("Tap + on the main screen to add something.")
                    )
                } else {
                    List {
                        // The count belongs here and only here: the point of
                        // this screen is that the pile has edges.
                        Section {
                            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                row(item, index: index)
                            }
                        } header: {
                            Text("\(items.count) \(items.count == 1 ? "thing" : "things"), in the order you'll see them. Swipe to move what matters to the top.")
                                .textCase(nil)
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .safeAreaInset(edge: .top) {
                Picker("Lane", selection: $kind) {
                    ForEach(StackKind.allCases) { lane in
                        // Counts are allowed on this screen, and nowhere else.
                        Text(list.map { "\(lane.label)  \($0.lanes[lane])" } ?? lane.label).tag(lane)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .background(Color(.systemGroupedBackground))
            }
            .navigationTitle("Everything")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Back to one at a time") { dismiss() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .onChange(of: kind) { _, _ in
                Task { await load() }
            }
            .alert("That didn't work", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            ), presenting: errorMessage) { _ in
                Button("OK") { errorMessage = nil }
            } message: { message in
                Text(message)
            }
        }
    }

    private func row(_ item: StackItem, index: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("\(index + 1)")
                .font(.footnote.monospacedDigit())
                .foregroundStyle(.quaternary)
                .frame(width: 22, alignment: .trailing)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                if item.isSleeping {
                    Text("sleeping until tomorrow")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if index > 0 {
                Button {
                    perform { try await StackService.rank(item.id, .top) }
                } label: {
                    Label("Do first", systemImage: "arrow.up.to.line")
                }
                .tint(Color.accentColor)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                perform { try await StackService.drop(item.id) }
            } label: {
                Label("Let go", systemImage: "xmark")
            }
            Button {
                perform { try await StackService.move(item.id, to: kind.other) }
            } label: {
                Label(kind.other.label, systemImage: "arrow.left.arrow.right")
            }
            .tint(Color.secondary)
        }
        .contextMenu {
            if index > 0 {
                Button { perform { try await StackService.rank(item.id, .up) } } label: {
                    Label("Move up", systemImage: "chevron.up")
                }
                Button { perform { try await StackService.rank(item.id, .top) } } label: {
                    Label("Do first", systemImage: "arrow.up.to.line")
                }
            }
            if index < items.count - 1 {
                Button { perform { try await StackService.rank(item.id, .down) } } label: {
                    Label("Move down", systemImage: "chevron.down")
                }
            }
            Divider()
            Button { perform { try await StackService.move(item.id, to: kind.other) } } label: {
                Label("Move to \(kind.other.label)", systemImage: "arrow.left.arrow.right")
            }
            Button(role: .destructive) { perform { try await StackService.drop(item.id) } } label: {
                Label("Let go", systemImage: "xmark")
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            list = try await StackService.everything(in: kind)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func perform(_ operation: @escaping () async throws -> Void) {
        guard !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await operation()
                list = try await StackService.everything(in: kind)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
