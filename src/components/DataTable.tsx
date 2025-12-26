import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Upload, User } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  label: string;
  type?: 'text' | 'number' | 'array' | 'select' | 'image' | 'resource-select';
  width?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface DataTableProps<T extends { id: string }> {
  title: string;
  icon: string;
  data: T[];
  columns: Column<T>[];
  onUpdate: (data: T[]) => void;
  emptyRow: Omit<T, 'id'>;
  selectOptions?: Record<string, SelectOption[]>;
  resourceOptions?: SelectOption[];
}

export function DataTable<T extends { id: string }>({
  title,
  icon,
  data,
  columns,
  onUpdate,
  emptyRow,
  selectOptions,
  resourceOptions,
}: DataTableProps<T>) {
  const [editingData, setEditingData] = useState<T[]>(data);

  const handleAdd = () => {
    const newItem = {
      ...emptyRow,
      id: Date.now().toString(),
    } as T;
    setEditingData([...editingData, newItem]);
  };

  const handleDelete = (id: string) => {
    setEditingData(editingData.filter(item => item.id !== id));
  };

  const handleChange = (id: string, key: keyof T, value: string | number | string[]) => {
    setEditingData(editingData.map(item => 
      item.id === id ? { ...item, [key]: value } : item
    ));
  };

  const handleImageUpload = (id: string, key: keyof T, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      handleChange(id, key, base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdate(editingData);
  };

  return (
    <div className="glass-card overflow-hidden animate-fade-in">
      <div className="gantt-header px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{icon} {title}</h2>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleAdd}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleSave}
            className="bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
          >
            <Save className="w-4 h-4 mr-1" /> Salvar
          </Button>
        </div>
      </div>
      
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50">
              {columns.map((col) => (
                <th 
                  key={String(col.key)} 
                  className="text-left px-4 py-2 text-sm font-semibold text-foreground border-b border-border"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-16 px-4 py-2 border-b border-border"></th>
            </tr>
          </thead>
          <tbody>
            {editingData.map((row) => (
              <tr 
                key={row.id} 
                className="hover:bg-accent/30 transition-colors bg-card"
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-3 py-1.5 border-b border-border">
                    {col.type === 'image' ? (
                      <div className="flex items-center gap-2">
                        {row[col.key] ? (
                          <img 
                            src={String(row[col.key])} 
                            alt="Foto" 
                            className="w-10 h-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(row.id, col.key, file);
                            }}
                          />
                          <span className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {row[col.key] ? 'Trocar' : 'Upload'}
                          </span>
                        </label>
                      </div>
                    ) : col.type === 'array' ? (
                      <Input
                        value={(row[col.key] as string[])?.join(', ') || ''}
                        onChange={(e) => handleChange(row.id, col.key, e.target.value.split(',').map(s => s.trim()))}
                        className="h-8 text-sm bg-background"
                        placeholder="Item1, Item2..."
                      />
                    ) : col.type === 'resource-select' && resourceOptions ? (
                      <Select
                        value={String(row[col.key] || '')}
                        onValueChange={(value) => handleChange(row.id, col.key, value)}
                      >
                        <SelectTrigger className="h-8 text-sm bg-background">
                          <SelectValue placeholder="Selecione um recurso" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-60">
                          {resourceOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : col.type === 'select' && selectOptions?.[String(col.key)] ? (
                      <Select
                        value={String(row[col.key] || '')}
                        onValueChange={(value) => handleChange(row.id, col.key, value)}
                      >
                        <SelectTrigger className="h-8 text-sm bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {selectOptions[String(col.key)].map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={col.type || 'text'}
                        value={String(row[col.key] || '')}
                        onChange={(e) => handleChange(
                          row.id, 
                          col.key, 
                          col.type === 'number' ? Number(e.target.value) : e.target.value
                        )}
                        className="h-8 text-sm bg-background"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-1.5 border-b border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(row.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
