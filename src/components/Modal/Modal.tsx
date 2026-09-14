import { useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** 点击遮罩（弹窗以外、窗口以内的区域）时是否调用 onClose；默认 false 保持显式按钮关闭 */
  closeOnOverlayClick?: boolean;
}

/**
 * 通用弹窗基座。
 * 默认遮罩点击不关闭，需显式按钮/关闭；传 closeOnOverlayClick 后点击遮罩等效「取消」。
 * 遮罩层点击一律 stopPropagation，避免穿透到底层日历/嵌套的外层弹窗。
 */
export default function Modal({ title, onClose, children, footer, width = 360, closeOnOverlayClick = false }: ModalProps) {
  // 记录按下起点是否在遮罩上：遮罩按下→弹窗内松开（或反向拖出）不算「点击遮罩」，防误关
  const downOnOverlay = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    downOnOverlay.current = e.target === e.currentTarget;
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (closeOnOverlayClick && downOnOverlay.current && e.target === e.currentTarget) onClose();
    downOnOverlay.current = false;
  };

  return (
    <div className="overlay" onMouseDown={handleMouseDown} onClick={handleClick}>
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
