const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'i18n', 'languages');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

const newKeysES = {
  "pro_benefits_title": "Beneficios PRO",
  "pro_sessions": "Sesiones PRO",
  "pro_venues_rates": "Locales y tarifas personalizadas",
  "pro_economy": "Economía PRO",
  "pro_analytics": "Analytics PRO",
  "pro_ai": "IA PRO",
  "pro_billing": "Facturación PRO",
  "subscription_explanation": "Desbloquea todas las funciones de DJ Planner Pro para llevar tu carrera al siguiente nivel.",
  "manage_apple_id": "Puedes gestionar o cancelar tu suscripción en cualquier momento desde los ajustes de tu cuenta de Apple ID.",
  "subscription_name_monthly": "Suscripción Mensual",
  "subscription_name_yearly": "Suscripción Anual"
};

const newKeysEN = {
  "pro_benefits_title": "PRO Benefits",
  "pro_sessions": "PRO Sessions",
  "pro_venues_rates": "Custom venues and rates",
  "pro_economy": "PRO Economy",
  "pro_analytics": "PRO Analytics",
  "pro_ai": "PRO AI",
  "pro_billing": "PRO Billing",
  "subscription_explanation": "Unlock all DJ Planner Pro features to take your career to the next level.",
  "manage_apple_id": "You can manage or cancel your subscription at any time from your Apple ID account settings.",
  "subscription_name_monthly": "Monthly Subscription",
  "subscription_name_yearly": "Yearly Subscription"
};

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const isSpanish = file === 'es.json' || file === 'es-ES.json' || file === 'es-MX.json';
  const keysToAdd = isSpanish ? newKeysES : newKeysEN; // fallback to EN for others
  
  for (const [key, value] of Object.entries(keysToAdd)) {
    if (!data[key]) {
      data[key] = value;
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
}
console.log('Translations updated successfully');
