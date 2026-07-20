-- Writes a shortcut's real icon (the colored rounded-square glyph shown in
-- the Shortcuts app) to a TIFF file on disk.
-- Usage: osascript get-shortcut-icon.applescript "<shortcut-id>" "<out-path.tiff>"
--
-- Plain AppleScript, not JXA — JXA's property bridge returns an empty
-- descriptor for the "icon" (TIFF image) property, but classic AppleScript's
-- `write` command correctly gets the raw TIFF bytes (verified on this Mac).
on run argv
	set theId to item 1 of argv
	set outPath to item 2 of argv
	try
		tell application "Shortcuts Events"
			set theShortcut to first shortcut whose id is theId
			set theIcon to icon of theShortcut
		end tell
	on error errMsg
		return "error: " & errMsg
	end try

	try
		set theFile to (POSIX file outPath)
		set fileRef to open for access theFile with write permission
		set eof fileRef to 0
		write theIcon to fileRef
		close access fileRef
	on error errMsg
		try
			close access theFile
		end try
		return "error: " & errMsg
	end try

	return "ok"
end run
