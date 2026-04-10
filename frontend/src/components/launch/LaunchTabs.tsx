'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function LaunchTabs({ launchId }: { launchId: string }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Dashboard', href: `/launches/${launchId}`, exact: true },
    { name: 'Grupos', href: `/launches/${launchId}/groups` },
    { name: 'Leads', href: `/launches/${launchId}/leads` },
    { name: 'Inbox IA', href: `/launches/${launchId}/inbox` },
    { name: 'Ações', href: `/launches/${launchId}/actions` },
    { name: 'Mensagens', href: `/launches/${launchId}/messages` },
    { name: 'Msg Privadas', href: `/launches/${launchId}/private-messages` },
    { name: 'Integrações', href: `/launches/${launchId}/integrations` },
    { name: 'Configurações', href: `/launches/${launchId}/settings` },
  ];

  return (
    <div className="border-b border-slate-200 mb-6 overflow-x-auto">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                ${isActive
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
