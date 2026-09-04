import SwiftUI

/// The one-card screen. This is the product.
///
/// Holding the whole pile in your head is what freezes you, and a full list on
/// screen recreates that exact overwhelm. So this shows one thing and nothing
/// else -- no remaining count, no list, no badges, not even on the lane tabs.
/// See PROBLEM.md.
struct NowView: View {
    @StateObject private var model = NowViewModel()

    var body: some View {
        ZStack {
            if model.isLoading && model.card == nil {
                ProgressView()
            } else if let card = model.card, let item = card.item {
                cardView(item, suggestSplit: card.suggestSplit)
            } else if let card = model.card {
                emptyLane(card)
            } else if let message = model.errorMessage {
                unreachable(message)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 24)
        .safeAreaInset(edge: .top) {
            lanePicker.padding(.bottom, 8)
        }
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $model.showBreakItUp) {
            if let item = model.card?.item {
                BreakItUpSheet(item: item, model: model)
            }
        }
        .alert("That didn't work", isPresented: model.hasError, presenting: model.errorMessage) { _ in
            Button("OK") { model.errorMessage = nil }
        } message: { message in
            Text(message)
        }
    }

    // The tabs carry no counts, for the same reason the card doesn't.
    private var lanePicker: some View {
        Picker("Lane", selection: $model.kind) {
            ForEach(StackKind.allCases) { kind in
                Text(kind.label).tag(kind)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 48)
        .onChange(of: model.kind) { _, newValue in
            model.switchLane(to: newValue)
        }
    }

    private func cardView(_ item: StackItem, suggestSplit: Bool) -> some View {
        VStack(spacing: 0) {
            Spacer()

            Text("RIGHT NOW")
                .font(.caption.weight(.medium))
                .tracking(2)
                .foregroundStyle(.tertiary)

            // Big enough to read from arm's length, like a sticky note on a
            // door -- not a row in a table.
            Text(item.title)
                .font(.system(size: 34, weight: .semibold))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
                .lineLimit(6)
                .padding(.top, 20)
                .padding(.horizontal, 8)

            if suggestSplit {
                Text("This one keeps coming back around. It might be bigger than one thing.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 16)
                    .padding(.horizontal, 16)
            }

            Spacer()

            VStack(spacing: 12) {
                Button {
                    model.done()
                } label: {
                    Text("Done")
                        .font(.title3.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                HStack(spacing: 10) {
                    secondaryMove("Not now") { model.notNow() }
                    secondaryMove("Not today") { model.notToday() }
                    secondaryMove("Too big") { model.showBreakItUp = true }
                }
            }
            .disabled(model.isBusy)

            // Kept quiet rather than a fifth button: the four moves are the
            // card's whole vocabulary, and this is a correction, not a move.
            Button("this belongs in \u{201C}\(model.kind.other.label)\u{201D}") {
                model.moveToOtherLane()
            }
            .font(.footnote)
            .foregroundStyle(.tertiary)
            .padding(.top, 20)
            .disabled(model.isBusy)

            Spacer(minLength: 24)
        }
    }

    private func secondaryMove(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.body.weight(.medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        }
        .buttonStyle(.bordered)
        .tint(Color.secondary)
    }

    // Nothing left in this lane. Calm, finished, no pressure to add more.
    private func emptyLane(_ card: NextCard) -> some View {
        let other = model.kind.other
        let otherWaiting = card.lanes[other] > 0

        return VStack(spacing: 14) {
            Spacer()
            Text(model.kind == .need ? "Nothing you have to do." : "Nothing on your want list.")
                .font(.title.weight(.semibold))
                .multilineTextAlignment(.center)

            Text(card.sleeping > 0
                 ? "Nothing else for today. \(card.sleeping) \(card.sleeping == 1 ? "card is" : "cards are") waiting for tomorrow."
                 : "This lane is clear.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            // Clearing your needs is the moment you've earned the other lane.
            if otherWaiting {
                Button(model.kind == .need ? "Go do something you want to" : "Back to what you need to do") {
                    model.kind = other
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.top, 20)
            } else {
                Text("Tap + to add something.")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 20)
            }

            if card.done > 0 {
                Text("\(card.done) cleared so far. That's the stack.")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 8)
            }
            Spacer()
        }
    }

    private func unreachable(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await model.load() }
            }
            .buttonStyle(.bordered)
        }
    }
}

@MainActor
final class NowViewModel: ObservableObject {
    private static let laneKey = "stack-lane"

    @Published var kind: StackKind
    @Published var card: NextCard?
    @Published var capabilities = StackCapabilities(splitAssist: false)
    @Published var isLoading = false
    @Published var isBusy = false
    @Published var errorMessage: String?
    @Published var showBreakItUp = false

    init() {
        // Remember which lane you were last in.
        let saved = UserDefaults.standard.string(forKey: Self.laneKey)
        kind = StackKind(rawValue: saved ?? "") ?? .need
    }

    var hasError: Binding<Bool> {
        Binding(
            get: { self.errorMessage != nil && self.card != nil },
            set: { if !$0 { self.errorMessage = nil } }
        )
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            card = try await StackService.next(in: kind)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
        // Best effort; a missing capabilities call just hides the AI button.
        if let caps = try? await StackService.capabilities() {
            capabilities = caps
        }
    }

    func switchLane(to newKind: StackKind) {
        UserDefaults.standard.set(newKind.rawValue, forKey: Self.laneKey)
        showBreakItUp = false
        Task { await load() }
    }

    func done() { perform { item in try await StackService.done(item.id) } }
    func notNow() { perform { item in try await StackService.push(item.id) } }
    func notToday() { perform { item in try await StackService.later(item.id) } }

    func moveToOtherLane() {
        let other = kind.other
        perform { item in try await StackService.move(item.id, to: other) }
    }

    /// Break the current card into pieces; the first piece is dealt next.
    func split(pieces: String) {
        showBreakItUp = false
        perform { item in _ = try await StackService.split(item.id, pieces: pieces) }
    }

    /// Ask Claude for the smallest first steps. Suggests only.
    func suggestPieces() async throws -> [String] {
        guard let item = card?.item else { return [] }
        return try await StackService.suggestSplit(item.id).pieces
    }

    /// Run a move against the current card, then deal the next one.
    private func perform(_ operation: @escaping (StackItem) async throws -> Void) {
        guard let item = card?.item, !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await operation(item)
                card = try await StackService.next(in: kind)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
