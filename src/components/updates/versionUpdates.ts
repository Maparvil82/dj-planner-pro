export type ProductUpdate = {
    id: string;
    kind: 'release' | 'roadmap';
    version: string | null;
    content: Record<string, { title: string; body: string }>;
    status: string;
};

// Ship these announcements with the new calendar code so the pending older
// build of 1.0.6 cannot announce functionality it does not contain.
const calendarUpdates: ProductUpdate[] = [
    {
        "id": "calendar-history-1.0.6",
        "kind": "release",
        "version": "1.0.6",
        "status": "published",
        "content": {
            "es": {
                "title": "Mejor visualización de sesiones pasadas",
                "body": "Consulta tu historial integrado en el calendario, con todas las sesiones del mes en tarjetas debajo de «Bloquear día». Recorre meses anteriores y regresa al mes actual con «Volver a hoy»."
            },
            "en": {
                "title": "Find past sessions more easily",
                "body": "Browse your history within the calendar, with every session for the month in cards below “Block day”. Explore previous months and return to the current month with “Back to today”."
            },
            "de": {
                "title": "Frühere Sessions leichter finden",
                "body": "Dein Verlauf ist in den Kalender integriert. Unter „Tag blockieren“ siehst du alle Sessions des Monats als Karten. Mit „Zurück zu heute“ gelangst du zum aktuellen Monat."
            },
            "fr": {
                "title": "Retrouvez vos sessions passées plus facilement",
                "body": "Consultez votre historique directement dans le calendrier. Toutes les sessions du mois apparaissent sous « Bloquer le jour » sous forme de cartes. Revenez au mois actuel avec « Revenir à aujourd’hui »."
            },
            "it": {
                "title": "Trova più facilmente le sessioni passate",
                "body": "Consulta lo storico integrato nel calendario, con tutte le sessioni del mese in schede sotto «Blocca giorno». Torna al mese attuale con «Torna a oggi»."
            },
            "pt": {
                "title": "Encontre sessões anteriores mais facilmente",
                "body": "Consulte o histórico integrado no calendário, com todas as sessões do mês em cartões abaixo de «Bloquear dia». Volte ao mês atual com «Voltar a hoje»."
            },
            "ja": {
                "title": "過去のセッションを見つけやすく",
                "body": "履歴をカレンダー内で確認できます。「日をブロック」の下にその月のすべてのセッションがカードで並び、「今日に戻る」で今月に戻れます。"
            }
        }
    },
    {
        "id": "self-employed-djs-1.0.6",
        "kind": "roadmap",
        "version": "1.0.6",
        "status": "under_consideration",
        "content": {
            "es": {
                "title": "Más herramientas para DJs autónomos",
                "body": "Estamos estudiando mejoras para organizar tus cobros, gastos y gestión profesional. Compartiremos más detalles cuando concretemos su alcance."
            },
            "en": {
                "title": "More tools for self-employed DJs",
                "body": "We are exploring improvements for managing your payments, expenses and professional work. We will share more details once the scope is defined."
            },
            "de": {
                "title": "Mehr Werkzeuge für selbstständige DJs",
                "body": "Wir prüfen Verbesserungen für Zahlungen, Ausgaben und deine berufliche Organisation. Weitere Details folgen, sobald der Umfang feststeht."
            },
            "fr": {
                "title": "Plus d’outils pour les DJ indépendants",
                "body": "Nous étudions des améliorations pour organiser vos encaissements, dépenses et votre activité professionnelle. Nous partagerons les détails une fois le périmètre défini."
            },
            "it": {
                "title": "Più strumenti per i DJ autonomi",
                "body": "Stiamo valutando miglioramenti per organizzare incassi, spese e attività professionale. Condivideremo altri dettagli una volta definito l’ambito."
            },
            "pt": {
                "title": "Mais ferramentas para DJs autónomos",
                "body": "Estamos a estudar melhorias para organizar recebimentos, despesas e a sua atividade profissional. Partilharemos mais detalhes quando o âmbito estiver definido."
            },
            "ja": {
                "title": "個人事業主のDJ向けツール",
                "body": "入金、経費、業務管理を整理するための改善を検討しています。対応範囲が決まり次第、詳細をお知らせします。"
            }
        }
    }
];

export function updatesForVersion(remote: ProductUpdate[], version: string): ProductUpdate[] {
    const items = remote.filter(item => item.kind === 'roadmap'
        ? !item.version || item.version === version
        : item.version === version);
    if (version !== '1.0.6') return items;
    return [...items.filter(item => !calendarUpdates.some(local => local.id === item.id)), ...calendarUpdates];
}
