import SwiftUI

@main
struct StackedWinsApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

// Placeholder ContentView
struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Stacked Wins")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            Text("Small wins build strong foundations")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}

// App state management
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var currentPlan: GrowthPlan?
    
    // Add authentication and state management logic here
}
