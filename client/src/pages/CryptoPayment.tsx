import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface CryptoWallets {
  btc: string | null;
  eth: string | null;
  usdt: string | null;
  usdt_erc20: string | null;
  usdt_trc20: string | null;
  usdt_bep20: string | null;
  ltc: string | null;
}

export default function CryptoPayment() {
  // All hooks MUST be called unconditionally at the top level
  const [wallets, setWallets] = useState<CryptoWallets | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // useQuery hook - always called, with error handling
  const { data: supportEmailData } = useQuery<{ email: string }>({
    queryKey: ['/api/support-email'],
    staleTime: 30000,
    enabled: true, // Always enabled to ensure consistent hook order
    retry: false, // Don't retry on failure to avoid multiple re-renders
    throwOnError: false,
  });

  // useEffect hook - always called
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/crypto-payment-info')
      .then(res => res.json())
      .then(data => {
        setWallets(data.wallets);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load payment info:', err);
        toast({ title: 'Error', description: 'Failed to load payment information', variant: 'destructive' });
        setIsLoading(false);
      });
  }, []); // Remove toast from deps to prevent re-fetch

  const copyToClipboard = async (address: string, currency: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(currency);
      toast({ title: 'Copied!', description: `${currency.toUpperCase()} address copied to clipboard` });
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to copy address', variant: 'destructive' });
    }
  };

  const cryptoOptions = [
    { key: 'btc', name: 'Bitcoin', symbol: 'BTC', color: 'text-orange-500', network: null },
    { key: 'eth', name: 'Ethereum', symbol: 'ETH', color: 'text-blue-500', network: null },
    { key: 'usdt_erc20', name: 'Tether (ERC20)', symbol: 'USDT', color: 'text-green-500', network: 'ERC20' },
    { key: 'usdt_trc20', name: 'Tether (TRC20)', symbol: 'USDT', color: 'text-green-500', network: 'TRC20' },
    { key: 'usdt_bep20', name: 'Tether (BEP20)', symbol: 'USDT', color: 'text-green-500', network: 'BEP20' },
    { key: 'ltc', name: 'Litecoin', symbol: 'LTC', color: 'text-gray-500', network: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Crypto Payment</h1>
          <p className="text-muted-foreground">Send cryptocurrency to top up your account</p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>How to Pay</CardTitle>
            <CardDescription>
              Select a cryptocurrency below, copy the wallet address, and send your payment. Your account will be credited once the transaction is confirmed.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-2 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Mail className="h-5 w-5" />
              Contact Administrator
            </CardTitle>
            <CardDescription className="text-blue-600 dark:text-blue-300">
              After completing your payment, please contact the administrator to credit your account. They will process your payment and update your balance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-md border border-blue-200 dark:border-blue-700">
              <Mail className="h-4 w-4 text-blue-600" />
              <a 
                href={`mailto:${supportEmailData?.email || 'ibiki_dash@proton.me'}`}
                className="font-mono text-sm text-blue-600 hover:underline"
              >
                {supportEmailData?.email || 'ibiki_dash@proton.me'}
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cryptoOptions.map(({ key, name, symbol, color, network }) => {
            const address = wallets?.[key as keyof CryptoWallets];
            if (!address) return null;

            return (
              <Card key={key} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${color}`}>
                    <span className="text-2xl">₿</span>
                    <span>{name}</span>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs break-all">
                    {symbol} {network ? `- ${network} Network` : 'Network'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                    {address}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(address, symbol)}
                    variant="outline"
                    className="w-full"
                  >
                    {copied === symbol ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy {symbol} Address
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {wallets && !Object.values(wallets).some(Boolean) && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
            <CardHeader>
              <CardTitle className="text-yellow-700 dark:text-yellow-500">
                Payment Information Not Available
              </CardTitle>
              <CardDescription className="text-yellow-600 dark:text-yellow-400">
                Crypto payment wallets are not configured yet. Please contact support.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Double-check the wallet address before sending</p>
            <p>• Use the correct blockchain network for each cryptocurrency</p>
            <p>• Credits will be added after confirmation (typically 10-30 minutes)</p>
            <p>• Contact support if your payment doesn't arrive within 1 hour</p>
            <p>• Minimum deposit may apply (contact support for details)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
