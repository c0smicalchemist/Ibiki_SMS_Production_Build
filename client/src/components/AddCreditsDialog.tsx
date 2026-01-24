import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { DollarSign } from "lucide-react";
import { useLocation } from "wouter";

export function AddCreditsDialog() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation('/crypto-payment');
  };

  return (
    <Button variant="outline" data-testid="button-add-credits" onClick={handleClick}>
      <DollarSign className="mr-2 h-4 w-4" />
      {t('dashboard.buttons.addCredits')}
    </Button>
  );
}
