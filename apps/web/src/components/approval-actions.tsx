import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ApprovalActions({ onApprove, onReject, disabled = false, size = 'sm' }: ApprovalActionsProps) {
  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'default' : 'sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3 w-3';

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size={buttonSize}
        onClick={(e) => {
          e.stopPropagation();
          onApprove();
        }}
        disabled={disabled}
        className={cn(
          "text-green-600 hover:text-green-700 hover:bg-green-50",
          "min-h-[44px] min-w-[44px] max-sm:h-10 max-sm:w-10 touch-manipulation",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        title="Approve and move to Done"
      >
        <CheckCircle className={iconSize} />
      </Button>
      <Button
        variant="ghost"
        size={buttonSize}
        onClick={(e) => {
          e.stopPropagation();
          onReject();
        }}
        disabled={disabled}
        className={cn(
          "text-red-600 hover:text-red-700 hover:bg-red-50",
          "min-h-[44px] min-w-[44px] max-sm:h-10 max-sm:w-10 touch-manipulation",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        title="Reject and move back to Doing"
      >
        <XCircle className={iconSize} />
      </Button>
    </div>
  );
}