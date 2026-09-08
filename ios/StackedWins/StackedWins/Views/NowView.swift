import SwiftUI

/// The one-card screen. This is the product.
///
/// Holding the whole pile in your head is what freezes you, and a full list on
/// screen recreates that exact overwhelm. So this shows one thing and nothing
/// else -- no remaining count, no list, no badges, not even on the lane tabs.
/// See PROBLEM.md.
///
/// The card is a real card: it sits on a short stack, you can throw it, and it
/// leaves in the direction you threw it. "Physically see what I need to do"
/// is the ask, and a thing you can push around with your thumb is more
/// physical than a paragraph you tap a button under.
struct NowView: View {
    @StateObject private var model = NowViewModel()

    /// Where the thumb has dragged the card to right now.
    @State private var drag: CGSize = .zero
    /// Where the card is flying off to, once a move is committed.
    @State private var exit: CGSize = .zero
    /// Whether the current drag has crossed into "letting go does something".
    @State private var armed: Move?
    @State private var showWins = false

    /// How far the card travels before a release counts as a move.
    private let commitDistance: CGFloat = 110

    /// The three moves you can throw a card into. "Too big" stays a button:
    /// it opens a sheet to type in, so a fling is the wrong gesture for it.
    private enum Move: Equatable {
        case done, notNow, notToday

        var label: String {
            switch self {
            case .done: return "Done"
            case .notNow: return "Not now"
            case .notToday: return "Tomorrow"
            }
        }

        var icon: String {
            switch self {
            case .done: return "checkmark"
            case .notNow: return "arrow.uturn.backward"
            case .notToday: return "moon.zzz"
            }
        }

        var tint: Color {
            switch self {
            case .done: return .green
            case .notNow: return .orange
            case .notToday: return .indigo
            }
        }

        /// Where the card goes when it leaves.
        var exit: CGSize {
            switch self {
            case .done: return CGSize(width: 700, height: -80)
            case .notNow: return CGSize(width: -700, height: -80)
            case .notToday: return CGSize(width: 0, height: 900)
            }
        }
    }

    var body: some View {
        ZStack {
            if model.isLoading && model.card == nil {
                ProgressView()
            } else if let card = model.card, let item = card.item {
                cardStack(item, suggestSplit: card.suggestSplit, behind: card.remaining - 1)
            } else if let card = model.card {
                emptyLane(card)
                    .transition(.opacity.combined(with: .scale(scale: 0.96)))
            } else if let message = model.errorMessage {
                unreachable(message)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 24)
        .safeAreaInset(edge: .top) { lanePicker.padding(.bottom, 4) }
        .safeAreaInset(edge: .bottom) { footer }
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $model.showBreakItUp) {
            if let item = model.card?.item {
                BreakItUpSheet(item: item, model: model)
            }
        }
        .sheet(isPresented: $showWins) {
            WinsView()
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
            drag = .zero
            armed = nil
            model.switchLane(to: newValue)
        }
    }

    // MARK: - The card

    /// Blank cards behind the real one. They carry no text, so the pile stays
    /// hidden -- but the stack is visibly a stack and the card you're holding
    /// is visibly the top of it.
    ///
    /// How many is capped at two, so the depth says "one more", "a couple" or
    /// "more than that" and never the actual size. What it buys is worth the
    /// sliver it gives away: on your last card there is nothing behind it, and
    /// seeing that is the opposite of overwhelm. Two ghosts under a lone card
    /// would be decoration pretending to be information.
    private func cardStack(_ item: StackItem, suggestSplit: Bool, behind: Int) -> some View {
        VStack(spacing: 0) {
            Spacer(minLength: 8)

            ZStack {
                if behind >= 2 { ghostCard(depth: 2) }
                if behind >= 1 { ghostCard(depth: 1) }
                card(item, suggestSplit: suggestSplit)
            }
            .frame(maxHeight: .infinity)
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: behind)

            moveButtons(suggestSplit: suggestSplit)
                .padding(.top, 24)

            // Kept quiet rather than a fifth button: the four moves are the
            // card's whole vocabulary, and this is a correction, not a move.
            Button("this belongs in \u{201C}\(model.kind.other.label)\u{201D}") {
                model.moveToOtherLane()
            }
            .font(.footnote)
            .foregroundStyle(.tertiary)
            .padding(.top, 16)
            .disabled(model.isBusy)
        }
    }

    private func ghostCard(depth: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .fill(Color(.secondarySystemBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.05))
            )
            .scaleEffect(1 - depth * 0.04)
            .offset(y: depth * 10)
            .opacity(1 - depth * 0.25)
            .accessibilityHidden(true)
    }

    private func card(_ item: StackItem, suggestSplit: Bool) -> some View {
        let offset = CGSize(width: drag.width + exit.width, height: drag.height + exit.height)
        let intent = move(for: drag)
        // How committed the drag is, 0...1. Drives the tint and the stamp.
        let progress = min(1, max(abs(drag.width), max(0, drag.height)) / commitDistance)

        return ZStack {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.14), radius: 18, y: 8)
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .strokeBorder((intent?.tint ?? .primary).opacity(intent == nil ? 0.07 : 0.55 * progress),
                                      lineWidth: intent == nil ? 1 : 2)
                )

            VStack(spacing: 0) {
                Text("RIGHT NOW")
                    .font(.caption.weight(.medium))
                    .tracking(2)
                    .foregroundStyle(.tertiary)

                // Big enough to read from arm's length, like a sticky note on
                // a door -- not a row in a table.
                Text(item.title)
                    .font(.system(size: 34, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.6)
                    .lineLimit(6)
                    .padding(.top, 20)

                if suggestSplit {
                    Text("This one keeps coming back around. It might be bigger than one thing.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 16)
                }
            }
            .padding(28)

            // The stamp: what letting go right now would do.
            if let intent {
                VStack(spacing: 6) {
                    Image(systemName: intent.icon).font(.system(size: 30, weight: .bold))
                    Text(intent.label.uppercased())
                        .font(.subheadline.weight(.heavy))
                        .tracking(2)
                }
                .foregroundStyle(intent.tint)
                .padding(.vertical, 14)
                .padding(.horizontal, 22)
                .background(intent.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(intent.tint.opacity(0.5), lineWidth: 2)
                )
                .rotationEffect(.degrees(-12))
                .opacity(progress)
                .scaleEffect(0.85 + 0.15 * progress)
                .allowsHitTesting(false)
            }
        }
        .offset(offset)
        // Pivots around the bottom of the card, the way a real card turns
        // when you push its top corner.
        .rotationEffect(.degrees(Double(offset.width) / 28), anchor: .bottom)
        .gesture(
            DragGesture(minimumDistance: 8)
                .onChanged { value in
                    guard !model.isBusy else { return }
                    drag = value.translation
                    let intent = move(for: value.translation)
                    if intent != armed {
                        // Only buzz on the way in, not on the way back out.
                        if intent != nil { Haptics.threshold() }
                        armed = intent
                    }
                }
                .onEnded { value in
                    guard !model.isBusy else { return }
                    if let intent = move(for: value.translation) {
                        commit(intent)
                    } else {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) { drag = .zero }
                    }
                    armed = nil
                }
        )
        // A new card is a new view, so it comes in fresh instead of the old
        // one's text swapping underneath a card that never moved.
        .id(item.id)
        .transition(.asymmetric(
            insertion: .scale(scale: 0.94).combined(with: .opacity),
            removal: .opacity
        ))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(item.title)
        .accessibilityHint("Swipe right to clear, left for not now, down for tomorrow. Or use the buttons below.")
    }

    /// Which move this drag is aiming at, if any. Horizontal wins ties, so a
    /// sloppy sideways throw doesn't land on "tomorrow".
    private func move(for translation: CGSize) -> Move? {
        let horizontal = translation.width
        let vertical = translation.height
        if abs(horizontal) >= abs(vertical) {
            if horizontal > commitDistance { return .done }
            if horizontal < -commitDistance { return .notNow }
        } else if vertical > commitDistance {
            return .notToday
        }
        return nil
    }

    /// Throw the card off screen, then perform the move. The animation runs
    /// first so the card leaves in the direction it was thrown; the next one
    /// is dealt when it's gone.
    private func commit(_ intent: Move) {
        withAnimation(.easeIn(duration: 0.22)) {
            exit = intent.exit
            drag = .zero
        }
        switch intent {
        case .done: model.done()
        case .notNow: model.notNow()
        case .notToday: model.notToday()
        }
        // Reset without animation once the card is gone, so the incoming card
        // starts from the middle rather than sliding back from off screen.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 220_000_000)
            exit = .zero
        }
    }

    // MARK: - Buttons, still the primary path

    private func moveButtons(suggestSplit: Bool) -> some View {
        VStack(spacing: 12) {
            Button {
                commit(.done)
            } label: {
                Text("Done")
                    .font(.title3.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            HStack(spacing: 10) {
                secondaryMove("Not now") { commit(.notNow) }
                secondaryMove("Not today") { commit(.notToday) }
                secondaryMove("Too big") { model.showBreakItUp = true }
                    .overlay(alignment: .topTrailing) {
                        // The card has been pushed enough times to earn a nudge.
                        if suggestSplit {
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 8, height: 8)
                                .offset(x: -6, y: 6)
                        }
                    }
            }
        }
        .disabled(model.isBusy)
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

    // MARK: - The footer: undo, and the wins

    private var footer: some View {
        VStack(spacing: 10) {
            // Both at once, on purpose: the mark you just earned appears in
            // the same beat as the offer to take it back.
            if let move = model.lastMove {
                undoBar(move)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            winsTrace
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 4)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: model.lastMove)
    }

    private func undoBar(_ move: String) -> some View {
        HStack(spacing: 12) {
            Text(move)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            Button("Undo") { model.undo() }
                .font(.footnote.weight(.semibold))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.thinMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.08)))
    }

    /// One mark per card cleared today. Marks, not a number: a growing count
    /// of what's *done* is safe (TODO.md), but digits on this screen read as
    /// a score, and a score is one more thing to think about. Past a dozen
    /// the row stops growing rather than turning into a crowd.
    private var winsTrace: some View {
        let wins = model.clearedToday
        return Button {
            showWins = true
        } label: {
            HStack(spacing: 5) {
                if wins == 0 {
                    Text("Nothing cleared yet today")
                        .font(.caption)
                        .foregroundStyle(.quaternary)
                } else {
                    ForEach(0..<min(wins, 12), id: \.self) { index in
                        Capsule()
                            .fill(Color.accentColor.opacity(0.75))
                            .frame(width: 12, height: 5)
                            .transition(.scale.combined(with: .opacity))
                            .animation(.spring(response: 0.4, dampingFraction: 0.6)
                                .delay(Double(index) * 0.01), value: wins)
                    }
                    if wins > 12 {
                        Text("+")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Color.accentColor.opacity(0.75))
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(wins == 0
                            ? "Nothing cleared yet today"
                            : "\(wins) cleared today. Open your wins.")
    }

    // MARK: - The end of a lane

    // Nothing left in this lane. Calm, finished, no pressure to add more.
    private func emptyLane(_ card: NextCard) -> some View {
        let other = model.kind.other
        let otherWaiting = card.lanes[other] > 0

        return VStack(spacing: 14) {
            Spacer()

            if card.done > 0 {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(Color.accentColor)
                    .padding(.bottom, 6)
            }

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
                Button {
                    showWins = true
                } label: {
                    Text("\(card.done) cleared. That's the stack.")
                        .font(.footnote)
                }
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

    /// How long the undo offer stays on screen. Long enough to notice a
    /// mis-tap, short enough that it isn't part of the furniture.
    private static let undoWindow: Duration = .seconds(6)

    @Published var kind: StackKind
    @Published var card: NextCard?
    @Published var capabilities = StackCapabilities(splitAssist: false)
    @Published var isLoading = false
    @Published var isBusy = false
    @Published var errorMessage: String?
    @Published var showBreakItUp = false

    /// What the last move did, while it can still be taken back.
    @Published var lastMove: String?
    /// Cards cleared today, in both lanes.
    @Published var clearedToday = 0

    private var undoTimer: Task<Void, Never>?

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
        // Best effort; a missing capabilities call just hides a button.
        if let caps = try? await StackService.capabilities() {
            capabilities = caps
        }
        await refreshWins()
    }

    func switchLane(to newKind: StackKind) {
        UserDefaults.standard.set(newKind.rawValue, forKey: Self.laneKey)
        showBreakItUp = false
        clearUndo()
        Task { await load() }
    }

    func done() { perform("done") { item in try await StackService.done(item.id) } }
    func notNow() { perform("push") { item in try await StackService.push(item.id) } }
    func notToday() { perform("later") { item in try await StackService.later(item.id) } }

    func moveToOtherLane() {
        let other = kind.other
        perform("move") { item in try await StackService.move(item.id, to: other) }
    }

    /// Break the current card into pieces; the first piece is dealt next.
    func split(pieces: String) {
        showBreakItUp = false
        perform("split") { item in _ = try await StackService.split(item.id, pieces: pieces) }
    }

    /// Ask Claude for the smallest first steps. Suggests only.
    func suggestPieces() async throws -> [String] {
        guard let item = card?.item else { return [] }
        return try await StackService.suggestSplit(item.id).pieces
    }

    /// Put the last move back, and deal whatever is now on top.
    func undo() {
        guard !isBusy else { return }
        isBusy = true
        clearUndo()
        Task {
            defer { isBusy = false }
            do {
                if try await StackService.undo() != nil {
                    Haptics.undo()
                }
                card = try await StackService.next(in: kind)
                await refreshWins()
            } catch {
                Haptics.failure()
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Run a move against the current card, then deal the next one.
    private func perform(_ move: String, _ operation: @escaping (StackItem) async throws -> Void) {
        guard let item = card?.item, !isBusy else { return }
        isBusy = true
        Task {
            defer { isBusy = false }
            do {
                try await operation(item)
                let next = try await StackService.next(in: kind)
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    card = next
                }
                if move == "done" {
                    Haptics.win()
                    // ...and that was the last one. A separate beat, late
                    // enough not to blur into the first.
                    if next.item == nil {
                        Task { @MainActor in
                            try? await Task.sleep(nanoseconds: 350_000_000)
                            Haptics.laneCleared()
                        }
                    }
                } else {
                    Haptics.move()
                }
                await refreshWins()
                offerUndo(for: move, item)
            } catch {
                Haptics.failure()
                errorMessage = error.localizedDescription
            }
        }
    }

    /// Show the "put that back" offer, and take it away again on its own.
    /// Only where the stack can actually undo (the phone, today).
    private func offerUndo(for move: String, _ item: StackItem) {
        guard capabilities.undo else { return }
        let title = item.title
        let description: String
        switch move {
        case "done": description = "Cleared \u{201C}\(title)\u{201D}"
        case "push": description = "Pushed \u{201C}\(title)\u{201D} back"
        case "later": description = "\u{201C}\(title)\u{201D} until tomorrow"
        case "move": description = "Moved \u{201C}\(title)\u{201D}"
        case "split": description = "Broke up \u{201C}\(title)\u{201D}"
        default: description = "Moved \u{201C}\(title)\u{201D}"
        }

        undoTimer?.cancel()
        lastMove = description
        undoTimer = Task { [weak self] in
            try? await Task.sleep(for: Self.undoWindow)
            guard !Task.isCancelled else { return }
            self?.lastMove = nil
        }
    }

    private func clearUndo() {
        undoTimer?.cancel()
        undoTimer = nil
        lastMove = nil
    }

    private func refreshWins() async {
        let startOfToday = Calendar.autoupdatingCurrent.startOfDay(for: Date())
        if let wins = try? await StackService.cleared(since: startOfToday) {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) {
                clearedToday = wins.count
            }
        }
    }
}
