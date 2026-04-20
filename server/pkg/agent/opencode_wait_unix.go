//go:build !windows

package agent

import (
	"context"
	"log/slog"
	"os/exec"
	"syscall"
	"time"
)

// setOpencodeProcessGroup configures cmd to run in a new process group so
// that background child processes spawned by opencode plugins remain
// discoverable after the direct child exits.
func setOpencodeProcessGroup(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
}

// getOpencodePgid returns the process-group ID for pid. When Setpgid is
// enabled this is usually the pid itself, but Getpgid is queried for safety.
func getOpencodePgid(pid int) int {
	if pid <= 0 {
		return -1
	}
	pgid, err := syscall.Getpgid(pid)
	if err != nil {
		return pid
	}
	return pgid
}

// waitForOpencodeChildren blocks until every process in pgid has exited or
// ctx is cancelled. It is called after cmd.Wait() returns so that the daemon
// does not mark a task complete while opencode background sub-agents are still
// running (e.g. when the oh-my-openagent plugin forks child sessions).
func waitForOpencodeChildren(pgid int, logger *slog.Logger, ctx context.Context) {
	if pgid <= 0 {
		return
	}
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			logger.Debug("stopped waiting for opencode background processes", "pgid", pgid, "reason", ctx.Err())
			return
		case <-ticker.C:
			if err := syscall.Kill(-pgid, 0); err != nil {
				// ESRCH => no processes remain in this process group.
				return
			}
			logger.Debug("waiting for background processes in opencode process group", "pgid", pgid)
		}
	}
}
