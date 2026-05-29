import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>未保存的更改</DialogTitle>
          <DialogDescription>
            您有未保存的更改，确定要离开吗？离开后更改将丢失。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            继续编辑
          </Button>
          <Button variant="default" onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            放弃更改并离开
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
