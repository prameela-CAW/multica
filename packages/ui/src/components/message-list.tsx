"use client";

import { MemoizedMarkdown } from "@multica/ui/components/markdown";
import { StreamingMarkdown } from "@multica/ui/components/markdown/StreamingMarkdown";
import { ToolCallItem } from "@multica/ui/components/tool-call-item";
import { cn } from "@multica/ui/lib/utils";
import type { Message } from "@multica/store";
import type { ContentBlock } from "@multica/sdk";

/** Extract plain text from ContentBlock[] */
function getTextContent(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")
}

/** Check if content has any toolCall blocks */
function getToolCalls(blocks: ContentBlock[]) {
  return blocks.filter((b): b is Extract<ContentBlock, { type: "toolCall" }> => b.type === "toolCall")
}

interface MessageListProps {
  messages: Message[]
  streamingIds: Set<string>
}

export function MessageList({ messages, streamingIds }: MessageListProps) {
  return (
    <div className="relative px-4 py-6 max-w-4xl mx-auto">
      {messages.map((msg) => {
        // ToolResult messages → render as tool execution item
        if (msg.role === "toolResult") {
          return <ToolCallItem key={msg.id} message={msg} />
        }

        const text = getTextContent(msg.content)
        const toolCalls = msg.role === "assistant" ? getToolCalls(msg.content) : []
        const isStreaming = streamingIds.has(msg.id)

        // Skip empty assistant messages that only contain toolCalls (no text)
        // The toolCalls are visible via the subsequent toolResult entries
        if (msg.role === "assistant" && !text && toolCalls.length > 0 && !isStreaming) {
          return null
        }

        // Skip completely empty messages
        if (!text && !isStreaming) return null

        return (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                msg.role === "user" ? "bg-muted rounded-md max-w-[60%] py-1 px-2.5 my-2" : "w-full py-1 px-2.5 my-1"
              )}
            >
              {isStreaming ? (
                <StreamingMarkdown content={text} isStreaming={true} mode="minimal" />
              ) : (
                <MemoizedMarkdown mode="minimal" id={msg.id}>
                  {text}
                </MemoizedMarkdown>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
