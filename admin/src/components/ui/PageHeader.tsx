import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Primary and secondary page actions, right-aligned (wraps under the title on phones). */
  actions?: ReactNode;
}

/** Page title block used at the top of every page. */
export default function PageHeader({ title, subtitle, eyebrow = "NESAM MASTER WORKSPACE", actions }: PageHeaderProps) {
  return (
    <div className="ds-title">
      <div>
        <span className="ds-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ds-title-actions">{actions}</div>}
    </div>
  );
}
