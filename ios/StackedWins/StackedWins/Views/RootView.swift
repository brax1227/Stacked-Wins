import SwiftUI

/// The one-card screen is the front door and the whole product. Everything
/// else hangs off it as low-salience toolbar items: a bar full of places to
/// go is exactly the kind of choosing this app exists to remove.
struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showDump = false
    @State private var showEverything = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            NowView()
                .navigationTitle("")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Menu {
                            Button {
                                showSettings = true
                            } label: {
                                Label("Server", systemImage: "network")
                            }
                            Button(role: .destructive) {
                                appState.signOut()
                            } label: {
                                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
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
        }
    }
}
