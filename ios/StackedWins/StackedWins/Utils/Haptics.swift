import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// The moves, felt rather than read.
///
/// A tap that does something invisible (the card is replaced by another card
/// that looks the same) reads as a tap that did nothing. A bump in the hand
/// says it landed, without a banner or a sound or anything else to dismiss.
///
/// Clearing gets a different, heavier feel than the other three on purpose:
/// it's the only move that finishes something.
enum Haptics {
    /// Cleared it. The one that's meant to feel good.
    static func win() {
        #if canImport(UIKit)
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
        #endif
    }

    /// A card moved: pushed back, sent to tomorrow, put in the other lane.
    static func move() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }

    /// The card has been dragged far enough that letting go will do something.
    /// Fires once as the threshold is crossed, so the thumb learns where it is.
    static func threshold() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.6)
        #endif
    }

    /// Put back. Deliberately softer than the move it undoes.
    static func undo() {
        #if canImport(UIKit)
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        #endif
    }

    /// The lane is clear. The end of a stack is worth marking.
    static func laneCleared() {
        #if canImport(UIKit)
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
        #endif
    }

    /// Something didn't work.
    static func failure() {
        #if canImport(UIKit)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        #endif
    }
}
