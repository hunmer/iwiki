import * as React from "react"
import { cn } from "@/lib/utils"
import { FileSearchIcon } from "lucide-react"

function Empty({
  icon,
  title,
  description,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title?: string
  description?: string
}) {
  return (
    <div
      data-slot="empty"
      className={cn("flex flex-col items-center justify-center py-8 text-center", className)}
      {...props}
    >
      <div className="text-muted-foreground/50 mb-3">
        {icon ?? <FileSearchIcon className="size-10" />}
      </div>
      {title && (
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
      )}
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
      )}
    </div>
  )
}

export { Empty }
