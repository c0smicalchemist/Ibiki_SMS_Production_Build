/**
 * Webshare Proxy Manager
 * Automatically fetches and rotates US proxies from Webshare API
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

interface WebshareProxy {
  id: string;
  username: string;
  password: string;
  proxy_address: string;
  port: number;
  valid: boolean;
  country_code: string;
  city_name: string;
}

interface WebshareProxyList {
  count: number;
  next: string | null;
  previous: string | null;
  results: WebshareProxy[];
}

class WebshareProxyManager {
  private static instance: WebshareProxyManager;
  private proxies: WebshareProxy[] = [];
  private currentIndex: number = 0;
  private lastFetch: number = 0;
  private fetchInterval: number = 5 * 60 * 1000; // Refresh every 5 minutes
  private apiKey: string;
  private isInitialized: boolean = false;

  private constructor() {
    this.apiKey = process.env.WEBSHARE_API_KEY || '';
  }

  public static getInstance(): WebshareProxyManager {
    if (!WebshareProxyManager.instance) {
      WebshareProxyManager.instance = new WebshareProxyManager();
    }
    return WebshareProxyManager.instance;
  }

  public isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Initialize by fetching proxies from Webshare
   */
  public async initialize(): Promise<void> {
    if (!this.apiKey) {
      console.log('[WebshareProxy] No WEBSHARE_API_KEY configured, using static proxy if available');
      return;
    }

    try {
      await this.fetchProxies();
      this.isInitialized = true;
      console.log(`[WebshareProxy] Initialized with ${this.proxies.length} US proxies`);
    } catch (error) {
      console.error('[WebshareProxy] Failed to initialize:', error);
    }
  }

  /**
   * Fetch US proxies from Webshare API
   */
  private async fetchProxies(): Promise<void> {
    try {
      const response = await fetch(
        'https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page_size=100&country_code__in=US',
        {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Webshare API error: ${response.status} ${response.statusText}`);
      }

      const data: WebshareProxyList = await response.json();
      
      // Filter only valid proxies
      this.proxies = data.results.filter(p => p.valid);
      this.lastFetch = Date.now();
      
      console.log(`[WebshareProxy] Fetched ${this.proxies.length} valid US proxies from Webshare`);
      
      if (this.proxies.length > 0) {
        console.log(`[WebshareProxy] Available cities: ${[...new Set(this.proxies.map(p => p.city_name))].join(', ')}`);
      }
    } catch (error) {
      console.error('[WebshareProxy] Error fetching proxies:', error);
      throw error;
    }
  }

  /**
   * Refresh proxies if needed (every 5 minutes)
   */
  private async refreshIfNeeded(): Promise<void> {
    if (Date.now() - this.lastFetch > this.fetchInterval) {
      await this.fetchProxies();
    }
  }

  /**
   * Get the next proxy in rotation
   */
  public async getNextProxy(): Promise<WebshareProxy | null> {
    if (!this.apiKey) return null;
    
    await this.refreshIfNeeded();
    
    if (this.proxies.length === 0) {
      return null;
    }

    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    
    return proxy;
  }

  /**
   * Get an HttpsProxyAgent for the next proxy
   */
  public async getProxyAgent(): Promise<HttpsProxyAgent<string> | null> {
    const proxy = await this.getNextProxy();
    
    if (!proxy) {
      return null;
    }

    const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
    console.log(`[WebshareProxy] Using proxy: ${proxy.proxy_address}:${proxy.port} (${proxy.city_name}, ${proxy.country_code})`);
    
    return new HttpsProxyAgent(proxyUrl);
  }

  /**
   * Get proxy URL string for the next proxy
   */
  public async getProxyUrl(): Promise<string | null> {
    const proxy = await this.getNextProxy();
    
    if (!proxy) {
      return null;
    }

    return `http://${proxy.username}:${proxy.password}@${proxy.proxy_address}:${proxy.port}`;
  }

  /**
   * Get current proxy count
   */
  public getProxyCount(): number {
    return this.proxies.length;
  }

  /**
   * Force refresh proxies from Webshare
   */
  public async forceRefresh(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Webshare API key not configured');
    }
    await this.fetchProxies();
  }

  /**
   * Get current proxy status for admin dashboard
   */
  public getStatus(): {
    enabled: boolean;
    initialized: boolean;
    proxyCount: number;
    currentIndex: number;
    lastFetch: number;
    proxies: Array<{
      id: string;
      address: string;
      port: number;
      city: string;
      country: string;
      valid: boolean;
      isActive: boolean;
    }>;
    source: string;
  } {
    return {
      enabled: this.isEnabled(),
      initialized: this.isInitialized,
      proxyCount: this.proxies.length,
      currentIndex: this.currentIndex,
      lastFetch: this.lastFetch,
      proxies: this.proxies.map((p, idx) => ({
        id: p.id,
        address: p.proxy_address,
        port: p.port,
        city: p.city_name,
        country: p.country_code,
        valid: p.valid,
        isActive: idx === this.currentIndex
      })),
      source: 'webshare'
    };
  }

  /**
   * Get static proxy status (fallback)
   */
  public static getStaticProxyStatus(): {
    enabled: boolean;
    url: string | null;
  } {
    const url = process.env.TEXTBELT_PROXY_URL || null;
    return {
      enabled: !!url,
      url: url ? url.replace(/\/\/.*@/, '//*****@') : null
    };
  }
}

export const webshareProxyManager = WebshareProxyManager.getInstance();
