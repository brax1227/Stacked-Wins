import SwiftUI

/// Optional. The stack lives on the phone until the user asks for a server;
/// this sheet is where they ask. Reached from the menu, never on launch.
struct LoginView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var creatingAccount = false
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var showSettings = false

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && password.count >= 8 && !isBusy
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer(minLength: 24)

                VStack(spacing: 8) {
                    Text("Sign in to a server")
                        .font(.largeTitle.weight(.bold))
                    Text("Optional. Your stack already lives on this phone. Sign in to keep it on a Stacked Wins server instead, and to use it from the web app too.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))

                    SecureField("Password (8+ characters)", text: $password)
                        .textContentType(creatingAccount ? .newPassword : .password)
                        .padding()
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                Button {
                    submit()
                } label: {
                    Group {
                        if isBusy {
                            ProgressView().tint(.white)
                        } else {
                            Text(creatingAccount ? "Create account" : "Sign in")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!canSubmit)

                Button(creatingAccount ? "I already have an account" : "Create an account") {
                    creatingAccount.toggle()
                    errorMessage = nil
                }
                .font(.footnote)
                .foregroundStyle(.secondary)

                Spacer()

                Button {
                    showSettings = true
                } label: {
                    Label(Config.serverURL, systemImage: "network")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 28)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Not now") { dismiss() }
                }
            }
            .sheet(isPresented: $showSettings) {
                ServerSettingsView()
            }
        }
    }

    private func submit() {
        guard canSubmit else { return }
        isBusy = true
        errorMessage = nil
        let email = self.email.trimmingCharacters(in: .whitespaces)
        let password = self.password
        let creating = creatingAccount
        Task {
            do {
                if creating {
                    try await appState.register(email: email, password: password)
                } else {
                    try await appState.signIn(email: email, password: password)
                }
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            isBusy = false
        }
    }
}
