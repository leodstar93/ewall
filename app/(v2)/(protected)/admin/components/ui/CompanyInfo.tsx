import type { CompanyInfo } from "@/lib/types";
import styles from "./CompanyInfo.module.css";

interface Props {
  data: CompanyInfo;
}

export default function CompanyInfoPanel({ data }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <svg viewBox="0 0 14 14" fill="none" stroke="var(--r)" strokeWidth="2">
            <rect x="1" y="3" width="12" height="9" rx="1" />
            <path d="M5 3V2a2 2 0 0 1 4 0v1" />
          </svg>
          Company Info
        </div>
        <button type="button" className={styles.editBtn}>
          Editar
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.top}>
          <div className={styles.logo}>
            <svg viewBox="0 0 22 22" fill="#fff">
              <polygon points="11,2 14,8 21,9 16,14 17,21 11,18 5,21 6,14 1,9 8,8" />
            </svg>
          </div>
          <div>
            <div className={styles.companyName}>{data.name}</div>
            <div className={styles.tagline}>{data.tagline}</div>
            <div className={styles.badge}>{data.plan}</div>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.field}>
            <div className={styles.label}>Industria</div>
            <div className={styles.value}>{data.industry}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.label}>Fundada</div>
            <div className={styles.value}>{data.founded}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.label}>Empleados</div>
            <div className={`${styles.value} ${styles.blue}`}>{data.employees}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.label}>Pais</div>
            <div className={styles.value}>{data.country}</div>
          </div>
          <div className={`${styles.field} ${styles.span2}`}>
            <div className={styles.label}>Contacto principal</div>
            <div className={`${styles.value} ${styles.blue}`}>{data.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
