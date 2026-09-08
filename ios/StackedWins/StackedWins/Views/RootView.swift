import SwiftUI

/// The one-card screen is the front door and the whole product. Everything
/// else hangs off it as low-salience toolbar items: a bar full of places to
/// go is exactly the kind of choosing this app exists to remove.
struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showDump = false
    @State private var showEverything = false
    @State private var showSettings = false
    @State private var showSignIn = false
    @State private var showWins = false
    @State private var checkedFirstOpen = false

    var body: some View {
        NavigationStack {
            NowView()
                // A new backend is a new stack: rebuild the screen so it
                // deals from the right one instead of showing the old card.
                .id(appState.usesServer)
                .navigationTitle("")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            if appState.usesServer {
                                if let email = appState.user?.email {
                                    Text(email)
                                }
                                Button {
                                    showSettings = true
                                } label: {
                                    Label("Server", systemImage: "network")
                                }
                                Button(role: .destructive) {
                                    appState.signOut()
                                } label: {
                                    Label("Sign out, use this phone", systemImage: "iphone")
                                }
                            } else {
                                Text("Your stack lives on this phone.")
                                Button {
                                    showSignIn = true
                                } label: {
                                    Label("Sign in to a server", systemImage: "network")
                                }
                            }
                            Divider()
                            Button {
                                showWins = true
                            } label: {
                                Label("Wins", systemImage: "checkmark.circle")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                        .tint(Color.secondary)
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showEverything = true
                        } label: {
                            Image(systemName: "list.bullet")
                        }
                        .tint(Color.secondary)
                        .accessibilityLabel("See everything")
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showDump = true
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Add something")
                    }
                }
                .sheet(isPresented: $showDump) {
                    DumpView()
                }
                .sheet(isPresented: $showEverything) {
                    EverythingView()
                }
                .sheet(isPresented: $showSettings) {
                    ServerSettingsView()
                }
                .sheet(isPresented: $showSignIn) {
                    LoginView()
                }
                .sheet(isPresented: $showWins) {
                    WinsView()
                }
                .task { await openTheDumpOnFirstUse() }
        }
    }

    /// The very first open goes straight to "put it all down", because an
    /// empty card screen asks the user to work out what to do next -- the
    /// exact thing they came here to stop doing. Once anything has ever been
    /// put down, the card screen is the front door.
    private func openTheDumpOnFirstUse() async {
        guard !checkedFirstOpen, !appState.usesServer else { return }
        checkedFirstOpen = true
        if (try? await LocalStackStore.shared.isEmpty()) == true {
            showDump = true
        }
    }
}
