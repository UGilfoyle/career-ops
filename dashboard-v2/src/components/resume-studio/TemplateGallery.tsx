'use client';

import { Modal, Card, Tag, Button, Badge } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { TEMPLATE_CATALOG, type TemplateMeta } from '@/lib/resume/ats-professional-template';
import { TemplatePreviewThumbnail } from './TemplatePreviewThumbnail';

type TemplateGalleryProps = {
  open: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function TemplateGallery({ open, selectedId, onClose, onSelect }: TemplateGalleryProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={780}
      destroyOnClose
      centered
      title={
        <div>
          <div className="text-base font-bold text-zinc-900">Choose a Resume Template</div>
          <div className="text-xs font-normal text-zinc-500 mt-0.5">
            ATS Classic recommended for maximum ATS score — all variants stay single-column for parsers.
          </div>
        </div>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" onClick={onClose}>
          Apply Template
        </Button>,
      ]}
    >
      <div className="py-3 max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEMPLATE_CATALOG.map((t) => {
            const isSelected = selectedId === t.id;
            return (
              <Card
                key={t.id}
                size="small"
                hoverable
                onClick={() => onSelect(t.id)}
                className={`cursor-pointer transition-all overflow-hidden border ${
                  isSelected
                    ? 'border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50/60 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                {/* Visual Realistic Thumbnail Preview */}
                <div className="mb-3">
                  <TemplatePreviewThumbnail templateId={t.id} />
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-zinc-900">{t.name}</span>
                      {t.id === 'ats-professional' && (
                        <Tag color="success" className="text-[10px] font-bold">
                          Recommended
                        </Tag>
                      )}
                      {t.badge && (
                        <Tag color="purple" className="text-[10px] font-bold">
                          {t.badge}
                        </Tag>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">
                      {t.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                      <CheckOutlined className="text-xs" />
                    </div>
                  )}
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <Tag color="default" className="text-[10px] font-mono">
                    Single-Column ATS
                  </Tag>
                  <Tag color="blue" className="text-[10px] font-mono">
                    100% Parser Safe
                  </Tag>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
