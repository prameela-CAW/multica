package analytics

import "strings"

// Event names. Keep in sync with docs/analytics.md.
const (
	EventSignup           = "signup"
	EventWorkspaceCreated = "workspace_created"
)

// Platform is used as the "platform" event property so funnels can split by
// web / desktop / cli. Request-path events use PlatformServer as a fallback
// when the caller is a server-originating action (e.g. auto-created user);
// otherwise the frontend passes the real platform via a header / body field
// in later iterations.
const (
	PlatformServer  = "server"
	PlatformWeb     = "web"
	PlatformDesktop = "desktop"
	PlatformCLI     = "cli"
)

// Signup builds the signup event. signupSource is populated from the
// frontend's stored UTM/referrer cookie if present; leave empty otherwise.
func Signup(userID, email, signupSource string) Event {
	return Event{
		Name:       EventSignup,
		DistinctID: userID,
		Properties: map[string]any{
			"email_domain":  emailDomain(email),
			"signup_source": signupSource,
		},
		SetOnce: map[string]any{
			"email":         email,
			"signup_source": signupSource,
		},
	}
}

// WorkspaceCreated builds the workspace_created event. "Is this the user's
// first workspace?" is deliberately not stamped here — it's derived in
// PostHog by checking whether the user has a prior workspace_created event.
func WorkspaceCreated(userID, workspaceID string) Event {
	return Event{
		Name:        EventWorkspaceCreated,
		DistinctID:  userID,
		WorkspaceID: workspaceID,
	}
}

func emailDomain(email string) string {
	at := strings.LastIndex(email, "@")
	if at < 0 || at == len(email)-1 {
		return ""
	}
	return strings.ToLower(email[at+1:])
}
