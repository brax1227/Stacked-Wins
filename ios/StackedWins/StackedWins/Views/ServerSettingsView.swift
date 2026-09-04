import SwiftUI

/// Where the API lives. This is how a TestFlight build talks to a backend on
/// your laptop: http://<your-mac's-lan-ip>:3001 on the same Wi-Fi.
struct ServerSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var url = Config.serverURL

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("https://api.example.com", text: $url)
                        .keyboardType(.URL)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Server address")
                } footer: {
                    Text("Host and port are enough — /api is added for you. For a backend on your own computer use its Wi-Fi address, e.g. http://192.168.1.20:3001. Plain http only works for local addresses; anything else needs https.")
                }

                if let bundled = Config.bundledServerURL {
                    Section {
                        Button("Use the built-in address") {
                            url = bundled
                        }
                    } footer: {
                        Text(bundled)
                    }
                }
            }
            .navigationTitle("Server")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Config.serverURL = url
                        dismiss()
                    }
                    .disabled(Config.apiBaseURLIfValid(url) == nil)
                }
            }
        }
    }
}
