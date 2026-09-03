import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** 通用弹窗基座（遮罩点击不关闭，需显式按钮/关闭）。 */
export default function Modal({ title, onClose, children, footer, width = 360 }: ModalProps) {
  return (
    <div className="overlay" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          <span>{title}</span>
          <button type="button" className="modal-x" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}