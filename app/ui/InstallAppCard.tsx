'use client';

import { useState } from 'react';
import useBrowserEnvironment from '../../hooks/use-browser-environment';
import { Check, Download, Share2, Smartphone } from 'lucide-react';

type InstallPrompt = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function InstallAppCard({
  prompt,
  onPromptUsed,
  variant = 'settings',
}: {
  prompt: InstallPrompt | null;
  onPromptUsed: () => void;
  variant?: 'login' | 'settings';
}) {
  const { ios, android, installed: installedInBrowser } = useBrowserEnvironment();
  const [installationAccepted, setInstallationAccepted] = useState(false);
  const installed = installedInBrowser || installationAccepted;
  const [message, setMessage] = useState('');


  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      onPromptUsed();
      setMessage(choice.outcome === 'accepted'
        ? 'Clareia adicionado à tela inicial.'
        : 'Você pode adicionar o Clareia depois pelo menu do navegador.');
      if (choice.outcome === 'accepted') setInstallationAccepted(true);
    } catch {
      onPromptUsed();
      setMessage('Use o menu do navegador para adicionar o Clareia à tela inicial.');
    }
  }

  return <div className={`install-app-card install-app-${variant}`}>
    <div className="install-app-heading">
      <span className="install-app-icon">{installed ? <Check size={19}/> : <Smartphone size={19}/>}</span>
      <div>
        <h3>{installed ? 'Clareia está instalado' : 'Tenha o Clareia na tela inicial'}</h3>
        <p>{installed ? 'Abra o ícone para usar o Clareia como um aplicativo.' : 'Toque em “Instalar app” para colocar o Clareia na tela inicial do Android ou iPhone.'}</p>
      </div>
    </div>
    {!installed && prompt && <button type="button" className="button secondary install-app-button" onClick={install}><Download size={16}/>Instalar app na tela inicial</button>}
    {!installed && ios && <ol className="install-app-steps">
      <li>Abra esta página no Safari e toque em <Share2 size={14}/> <strong>Compartilhar</strong>.</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li>
    </ol>}
    {!installed && !ios && !prompt && <p className="install-app-help">{android ? <>No Android, abra o menu <strong>⋮</strong> do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</> : <>No Chrome ou Edge, abra o menu <strong>⋮</strong> e escolha <strong>Instalar Clareia</strong>. No iPhone, abra no Safari e use Compartilhar para adicionar à tela inicial.</>}</p>}
    {message && <p className="install-app-message" role="status">{message}</p>}
  </div>;
}
