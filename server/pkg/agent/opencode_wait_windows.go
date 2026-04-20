//go:build windows

package agent

import (
	"context"
	"log/slog"
	"os/exec"
)

// setOpencodeProcessGroup is a no-op on Windows. Waiting for all child
// processes in a process group on Windows requires Job Objects, which are not
// implemented here.
func setOpencodeProcessGroup(cmd *exec.Cmd) {}

// getOpencodePgid returns -1 on Windows because Unix-style process groups are
// not available.
func getOpencodePgid(pid int) int { return -1 }

// waitForOpencodeChildren is a no-op on Windows.
func waitForOpencodeChildren(pgid int, logger *slog.Logger, ctx context.Context) {}
