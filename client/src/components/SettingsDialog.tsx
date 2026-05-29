import { useState, useRef } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: Props) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.exportData();
      toast.success('数据导出成功');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导出失败';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 校验文件扩展名
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('请选择 ZIP 文件');
      return;
    }

    // 校验 MIME 类型
    const allowedMimeTypes = ['application/zip', 'application/x-zip-compressed'];
    if (!allowedMimeTypes.includes(file.type) && file.type !== '') {
      toast.error('文件类型不正确，请选择 ZIP 文件');
      return;
    }

    // 校验文件大小（200MB）
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('文件大小超过限制（最大 200MB）');
      return;
    }

    setImporting(true);
    try {
      const result = await api.importData(file);
      const parts = [
        result.nodesAdded > 0 ? `${result.nodesAdded} 个文档节点` : '',
        result.versionsAdded > 0 ? `${result.versionsAdded} 个版本` : '',
        result.commentsAdded > 0 ? `${result.commentsAdded} 条评论` : '',
        result.embeddingsAdded > 0 ? `${result.embeddingsAdded} 个嵌入向量` : '',
        result.docsAdded > 0 ? `${result.docsAdded} 个文档文件` : '',
        result.uploadsAdded > 0 ? `${result.uploadsAdded} 个上传文件` : '',
      ].filter(Boolean);

      toast.success(`导入成功：新增 ${parts.join('、')}`);
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '导入失败';
      toast.error(message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>导入和导出 iWiki 数据</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="export" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="export" className="flex-1">
              <Download className="h-4 w-4 mr-1" /> 导出
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1">
              <Upload className="h-4 w-4 mr-1" /> 导入
            </TabsTrigger>
          </TabsList>
          <TabsContent value="export" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              将所有数据（文档、数据库、上传文件）打包为 ZIP 文件下载。
            </p>
            <Button onClick={handleExport} disabled={exporting} className="w-full">
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {exporting ? '导出中...' : '导出数据'}
            </Button>
          </TabsContent>
          <TabsContent value="import" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              上传 iWiki 导出的 ZIP 文件，新数据将合并到当前数据中（不会覆盖现有数据）。
            </p>
            <input
              type="file"
              accept=".zip"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full"
            >
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {importing ? '导入中...' : '选择 ZIP 文件导入'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
