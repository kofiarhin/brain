# Handoff: Automating the Brain Refresh Workflow with Windows Task Scheduler

## Objective

Create a Windows Scheduled Task that behaves exactly like the existing
**Brain Good Morning Codex** task, but automatically runs the **refresh
brain** Brain OS workflow.

**Desired schedule** - 6:00 AM - 12:00 PM

------------------------------------------------------------------------

# Project Context

The Brain project lives at:

``` text
C:\Users\laura.bolas\projects\brain
```

The Brain OS can be driven interactively through the Codex CLI.

### Manual workflow (works)

``` bash
codex
```

Then, inside the interactive Codex session:

``` text
refresh brain
```

This successfully starts the Brain maintenance workflow.

------------------------------------------------------------------------

# Existing Working Automation

A Windows scheduled task already exists:

**Task Name**

``` text
Brain Good Morning Codex
```

Inspection of the task shows it launches Git Bash and runs Codex from
inside the Brain repository.

Action:

``` text
Execute:
C:\Program Files\Git\bin\bash.exe

Arguments:
-lc "cd ~/projects/brain && codex 'good morning'"
```

This task works correctly every day.

------------------------------------------------------------------------

# Goal

Replicate the exact implementation used by **Brain Good Morning Codex**,
but execute:

``` text
refresh brain
```

instead.

------------------------------------------------------------------------

# Attempts Made

## Attempt 1 -- PowerShell + codex.ps1

Originally attempted to schedule:

``` powershell
powershell.exe
-NoProfile -ExecutionPolicy Bypass -File codex.ps1
```

This launched Codex but did not behave like the existing Good Morning
task.

This approach was abandoned.

------------------------------------------------------------------------

## Attempt 2 -- Git Bash (matching Good Morning)

Created a new task using:

``` text
Execute:
C:\Program Files\Git\bin\bash.exe

Arguments:
-lc "cd /c/Users/laura.bolas/projects/brain && codex 'refresh brain'"
```

Trigger:

-   Daily
-   6:00 AM

The task starts successfully.

------------------------------------------------------------------------

# Current Behaviour

Running:

``` powershell
Start-ScheduledTask -TaskName "Brain Refresh Codex"
```

shows:

``` text
State: Running
```

Meaning:

-   Windows Task Scheduler works.
-   Git Bash launches.
-   The Brain project directory is correct.
-   Codex starts.

However:

``` powershell
Get-ScheduledTaskInfo -TaskName "Brain Refresh Codex"
```

returns:

``` text
LastTaskResult:
2147946720
```

which corresponds to:

``` text
0x80070020

The process cannot access the file because it is being used by another process.
```

------------------------------------------------------------------------

# Investigation

Running:

``` powershell
tasklist | findstr codex
```

shows multiple running instances:

``` text
codex.exe
codex.exe
```

Therefore another Codex instance is already running when the scheduled
task executes.

------------------------------------------------------------------------

# Important Discovery

The command:

``` text
refresh brain
```

is **not** a standalone shell command.

It is a **Brain OS prompt** entered **inside an interactive Codex
session**.

Manual workflow:

``` bash
codex
```

then

``` text
refresh brain
```

works perfectly.

Codex replies that it will execute the Brain maintenance workflow.

------------------------------------------------------------------------

# Current Hypothesis

Although the working Good Morning task appears to call:

``` bash
codex 'good morning'
```

there is likely additional behaviour involved, such as:

-   interactive Codex mode
-   a wrapper around the CLI
-   shell profile initialisation
-   Codex execution mode
-   Brain OS startup logic

Simply replacing `"good morning"` with `"refresh brain"` is not yet
producing the same behaviour.

------------------------------------------------------------------------

# Remaining Investigation

The next step is to inspect the working task in detail and compare it
with the Refresh task.

Run:

``` powershell
(Get-ScheduledTask "Brain Good Morning Codex").Actions | Format-List *
```

or

``` powershell
Export-ScheduledTask -TaskName "Brain Good Morning Codex"
```

Inspect:

-   Execute
-   Arguments
-   WorkingDirectory

Compare those values with the Refresh task.

If there are any differences, reproduce them exactly.

------------------------------------------------------------------------

# Success Criteria

The finished scheduled task should:

1.  Launch Git Bash.
2.  Change into the Brain repository.
3.  Start the same Codex workflow used by the Good Morning task.
4.  Execute the Brain OS prompt:

``` text
refresh brain
```

5.  Complete automatically without leaving an interactive Codex session
    running.
