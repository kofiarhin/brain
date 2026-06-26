const categoryRules = [
  ['projects', ['project', 'client', 'build', 'deploy', 'code', 'app', 'feature', 'bug', 'github', 'repo', 'api']],
  ['family', ['family', 'mum', 'dad', 'karen', 'kids', 'school', 'home']],
  ['personal', ['gym', 'health', 'doctor', 'workout', 'journal', 'learn', 'read']],
  ['admin', ['bill', 'invoice', 'bank', 'tax', 'email', 'call', 'renew', 'appointment']]
];

export function categorizeTaskTitle(title = '') {
  const words = String(title).toLowerCase().match(/[a-z0-9]+/g) || [];
  const wordSet = new Set(words);
  return categoryRules.find(([, keywords]) => keywords.some((keyword) => wordSet.has(keyword)))?.[0] || 'general';
}
