'use client';

import { useEffect, useState } from 'react';
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
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const platform = navigator as Navigator & { userAgentData?: { platform?: string } };
    setInstalled(standalone);
    setAndroid(/Android/i.test(navigator.userAgent));
    setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (platform.userAgentData?.platform === 'iOS')
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      onPromptUsed();
      setMessage(choice.outcome === 'accepted'
        ? 'Clareia adicionado à tela inicial.'
        : 'Você pode adicionar o Clareia depois pelo menu do navegador.');
      if (choice.outcome === 'accepted') setInstalled(true);
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
        <p>{installed ? 'Abra o ícone para usar o Clareia como um aplicativo.' : 'Abra suas finanças direto pelo ícone, em uma janela própria.'}</p>
      </div>
    </div>
    {!installed && prompt && <button type="button" className="button secondary install-app-button" onClick={install}><Download size={16}/>Adicionar à tela inicial</button>}
    {!installed && ios && <ol className="install-app-steps">
      <li>Abra esta página no Safari e toque em <Share2 size={14}/> <strong>Compartilhar</strong>.</li>
      <li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme.</li>
    </ol>}
    {!installed && !ios && !prompt && <p className="install-app-help">{android ? <>No Android, abra o menu <strong>⋮</strong> do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</> : <>No Chrome ou Edge, abra o menu <strong>⋮</strong> e escolha <strong>Instalar Clareia</strong>. No iPhone, abra no Safari e use Compartilhar para adicionar à tela inicial.</>}</p>}
    {message && <p className="install-app-message" role="status">{message}</p>}
  </div>;
}
