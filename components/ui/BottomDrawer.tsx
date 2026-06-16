"use client";

interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export default function BottomDrawer({ open, onClose, children, title }: BottomDrawerProps) {
  return (
    <>
      <div className={`bdrawer-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`bdrawer${open ? " open" : ""}`} role="dialog" aria-modal="true">
        <div className="bdrawer-handle" />
        {title && (
          <div style={{ padding: "4px 20px 16px", fontFamily: "var(--display)", fontWeight: 800, fontSize: 16, color: "var(--ink)", borderBottom: "1px solid var(--line)" }}>
            {title}
          </div>
        )}
        <div className="bdrawer-content">{children}</div>
      </div>
    </>
  );
}
