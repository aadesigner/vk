/**
 * One-off: append remaining free-decoder SEO translations to data file.
 * Run: node scripts/add-free-decoder-langs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(dir, "data", "free-decoder-seo-i18n.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const more = {
  es: {
    free_decoder_seo_badge: "Guía VIN",
    free_decoder_seo_title: "Decodificador VIN gratis para BMW, Audi, Mercedes y más",
    free_decoder_seo_sub:
      "Decodifique cualquier VIN de 17 dígitos: año, marca, modelo, motor y datos de fábrica. Importaciones alemanas, japonesas, americanas y coreanas — luego desbloquee kilometraje y accidentes.",
    free_decoder_seo_how_title: "Cómo funciona el decodificador VIN",
    free_decoder_seo_how_sub:
      "Cada número de bastidor sigue la norma ISO 3779. Leemos WMI, VDS y VIS al instante.",
    free_decoder_seo_step_0_title: "Introduzca el VIN de 17 dígitos",
    free_decoder_seo_step_0_desc:
      "Escriba o pegue el bastidor del parabrisas, puerta o documentación.",
    free_decoder_seo_step_1_title: "WMI identifica la marca",
    free_decoder_seo_step_1_desc:
      "Los tres primeros caracteres: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT), etc.",
    free_decoder_seo_step_2_title: "VDS revela modelo y motor",
    free_decoder_seo_step_2_desc:
      "Caracteres 4–9: línea de modelo, carrocería, motor y seguridad.",
    free_decoder_seo_step_3_title: "Desbloquee el historial",
    free_decoder_seo_step_3_desc:
      "Gratis: datos de fábrica. Informe completo: kilometraje, accidentes, salvage y robo verificados.",
    free_decoder_seo_brands_title: "Decodificadores VIN por marca",
    free_decoder_seo_brands_sub:
      "Toque una marca para probar un VIN de ejemplo — o pegue el suyo arriba.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "Decodificador VIN BMW",
    free_decoder_brand_bmw_desc:
      "Bastidores BMW: Serie 3, 5, X5, M. WMI WBA, WBS, 5UX y plantas alemanas/EE. UU.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Decodificador VIN Audi",
    free_decoder_brand_audi_desc:
      "VIN Audi (WAU, TRU): A3, A4, A6, Q5, RS — modelo, motor y fábrica.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Decodificador VIN Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): Clase C, E, GLC, AMG — datos de fábrica del bastidor.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Decodificador VIN Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, código y planta al instante.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Decodificador VIN Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — año, motor y origen.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Decodificador VIN Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — datos NHTSA para EE. UU. e importación.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Decodificador VIN Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — año, cilindrada y planta.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Decodificador VIN Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — esencial antes de importar de Corea.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Qué significa cada parte del VIN",
    free_decoder_seo_vin_desc:
      "El VIN no es aleatorio. Tres bloques ayudan a verificar el coche antes de comprar.",
    free_decoder_seo_vin_wmi: "WMI — marca y país",
    free_decoder_seo_vin_vds: "VDS — modelo y motor",
    free_decoder_seo_vin_vis: "VIS — serie y año",
    free_decoder_seo_faq_badge: "FAQ",
    free_decoder_seo_faq_title: "Preguntas sobre el decodificador VIN",
    free_decoder_faq_0_q: "¿Qué es un decodificador VIN gratuito?",
    free_decoder_faq_0_a:
      "Lee el bastidor de 17 dígitos y devuelve datos de fábrica. Kilometraje y accidentes requieren el informe completo.",
    free_decoder_faq_1_q: "¿Funciona con VIN de BMW y Audi?",
    free_decoder_faq_1_a:
      "Sí. Prefijos WMI alemanes (WBA, WBS, WAU, WDD, WVW) totalmente compatibles.",
    free_decoder_faq_2_q: "¿Es realmente gratis?",
    free_decoder_faq_2_a:
      "Sí — año, marca, modelo, motor y dígito de control son gratis. Sin suscripción.",
    free_decoder_faq_3_q: "¿Diferencia con el informe completo?",
    free_decoder_faq_3_a:
      "Decodificador = datos de fábrica. Informe = kilometraje, accidentes, salvage y robo en bases de datos.",
    free_decoder_seo_cta_title: "Datos de fábrica gratis. Historial a un clic.",
    free_decoder_seo_cta_desc:
      "Tras decodificar, desbloquee kilometraje verificado, accidentes y salvage — en segundos.",
    free_decoder_seo_cta_btn: "Ver precios del informe",
    free_decoder_example_try: "Probar VIN de ejemplo",
  },
  fr: {
    free_decoder_seo_badge: "Guide VIN",
    free_decoder_seo_title: "Décodeur VIN gratuit pour BMW, Audi, Mercedes et plus",
    free_decoder_seo_sub:
      "Décodez tout VIN 17 caractères : année, marque, modèle, moteur et données usine. Imports allemands, japonais, américains et coréens — puis historique km et accidents.",
    free_decoder_seo_how_title: "Comment fonctionne le décodeur VIN",
    free_decoder_seo_how_sub:
      "Chaque numéro de série suit la norme ISO 3779. Nous lisons WMI, VDS et VIS instantanément.",
    free_decoder_seo_step_0_title: "Saisissez le VIN à 17 caractères",
    free_decoder_seo_step_0_desc:
      "Collez le numéro du pare-brise, portière ou carte grise.",
    free_decoder_seo_step_1_title: "WMI identifie la marque",
    free_decoder_seo_step_1_desc:
      "Les trois premiers caractères : BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT), etc.",
    free_decoder_seo_step_2_title: "VDS révèle modèle et moteur",
    free_decoder_seo_step_2_desc:
      "Caractères 4–9 : ligne, carrosserie, moteur et systèmes de sécurité.",
    free_decoder_seo_step_3_title: "Débloquez l'historique",
    free_decoder_seo_step_3_desc:
      "Gratuit : specs usine. Rapport complet : km, accidents, épave et vol vérifiés.",
    free_decoder_seo_brands_title: "Décodeurs VIN par marque",
    free_decoder_seo_brands_sub:
      "Appuyez sur une marque pour un VIN exemple — ou collez le vôtre ci-dessus.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "Décodeur VIN BMW",
    free_decoder_brand_bmw_desc:
      "Numéros BMW : Série 3, 5, X5, M. WMI WBA, WBS, 5UX et usines DE/US.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Décodeur VIN Audi",
    free_decoder_brand_audi_desc:
      "VIN Audi (WAU, TRU) : A3, A4, A6, Q5, RS — modèle, moteur et usine.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Décodeur VIN Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG) : Classe C, E, GLC, AMG — données usine du châssis.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Décodeur VIN Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW) : Golf, Passat, Tiguan, ID — WMI, code modèle et usine.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Décodeur VIN Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD) : Camry, Corolla, RAV4 — année, moteur et origine.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Décodeur VIN Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT) : F-150, Mustang, Explorer — données NHTSA USA/import.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Décodeur VIN Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM) : Civic, Accord, CR-V — année, cylindrée et usine.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Décodeur VIN Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP) : Elantra, Tucson, Santa Fe — essentiel avant import Corée.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Signification de chaque partie du VIN",
    free_decoder_seo_vin_desc:
      "Le VIN n'est pas aléatoire. Trois blocs pour vérifier le véhicule avant achat.",
    free_decoder_seo_vin_wmi: "WMI — marque et pays",
    free_decoder_seo_vin_vds: "VDS — modèle et moteur",
    free_decoder_seo_vin_vis: "VIS — série et année",
    free_decoder_seo_faq_badge: "FAQ",
    free_decoder_seo_faq_title: "Questions sur le décodeur VIN",
    free_decoder_faq_0_q: "Qu'est-ce qu'un décodeur VIN gratuit ?",
    free_decoder_faq_0_a:
      "Lit le châssis 17 caractères et renvoie les données usine. Km et accidents dans le rapport complet.",
    free_decoder_faq_1_q: "Fonctionne-t-il pour BMW et Audi ?",
    free_decoder_faq_1_a:
      "Oui. Préfixes WMI allemands (WBA, WBS, WAU, WDD, WVW) pris en charge.",
    free_decoder_faq_2_q: "Est-ce vraiment gratuit ?",
    free_decoder_faq_2_a:
      "Oui — année, marque, modèle, moteur et chiffre de contrôle gratuits. Sans abonnement.",
    free_decoder_faq_3_q: "Différence avec le rapport complet ?",
    free_decoder_faq_3_a:
      "Décodeur = specs usine. Rapport = km, accidents, épave et vol en bases de données.",
    free_decoder_seo_cta_title: "Specs usine gratuites. Historique à un clic.",
    free_decoder_seo_cta_desc:
      "Après décodage, débloquez km vérifié, accidents et épave — en quelques secondes.",
    free_decoder_seo_cta_btn: "Voir les tarifs",
    free_decoder_example_try: "Essayer un VIN exemple",
  },
  pl: {
    free_decoder_seo_badge: "Przewodnik VIN",
    free_decoder_seo_title: "Darmowy dekoder VIN dla BMW, Audi, Mercedes i innych",
    free_decoder_seo_sub:
      "Zdekoduj dowolny 17-znakowy VIN: rok, marka, model, silnik i dane fabryczne. Importy z Niemiec, Japonii, USA i Korei — potem przebieg i wypadki w pełnym raporcie.",
    free_decoder_seo_how_title: "Jak działa dekoder VIN",
    free_decoder_seo_how_sub:
      "Każdy numer nadwozia spełnia normę ISO 3779. Odczytujemy WMI, VDS i VIS natychmiast.",
    free_decoder_seo_step_0_title: "Wpisz 17-znakowy VIN",
    free_decoder_seo_step_0_desc:
      "Wklej numer z szyby, drzwi lub dokumentów rejestracyjnych.",
    free_decoder_seo_step_1_title: "WMI identyfikuje markę",
    free_decoder_seo_step_1_desc:
      "Pierwsze trzy znaki: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT) itd.",
    free_decoder_seo_step_2_title: "VDS pokazuje model i silnik",
    free_decoder_seo_step_2_desc:
      "Znaki 4–9: linia modelu, nadwozie, silnik i systemy bezpieczeństwa.",
    free_decoder_seo_step_3_title: "Odblokuj historię",
    free_decoder_seo_step_3_desc:
      "Za darmo: dane fabryczne. Pełny raport: przebieg, wypadki, salvage i kradzież.",
    free_decoder_seo_brands_title: "Dekodery VIN według marki",
    free_decoder_seo_brands_sub:
      "Kliknij markę, aby wypróbować przykładowy VIN — lub wklej swój powyżej.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "Dekoder VIN BMW",
    free_decoder_brand_bmw_desc:
      "Numery BMW: Seria 3, 5, X5, M. WMI WBA, WBS, 5UX i zakłady DE/US.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Dekoder VIN Audi",
    free_decoder_brand_audi_desc:
      "VIN Audi (WAU, TRU): A3, A4, A6, Q5, RS — model, silnik i zakład.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Dekoder VIN Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): Klasa C, E, GLC, AMG — dane fabryczne z VIN.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Dekoder VIN Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, kod modelu i zakład.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Dekoder VIN Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — rok, silnik i pochodzenie.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Dekoder VIN Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — dane NHTSA dla USA i importu.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Dekoder VIN Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — rok, pojemność i zakład.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Dekoder VIN Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — ważne przed importem z Korei.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Co oznacza każda część VIN",
    free_decoder_seo_vin_desc:
      "VIN nie jest losowy. Trzy bloki pomagają zweryfikować auto przed zakupem.",
    free_decoder_seo_vin_wmi: "WMI — marka i kraj",
    free_decoder_seo_vin_vds: "VDS — model i silnik",
    free_decoder_seo_vin_vis: "VIS — numer seryjny i rok",
    free_decoder_seo_faq_badge: "FAQ",
    free_decoder_seo_faq_title: "Pytania o dekoder VIN",
    free_decoder_faq_0_q: "Czym jest darmowy dekoder VIN?",
    free_decoder_faq_0_a:
      "Odczytuje 17-znakowy numer i zwraca dane fabryczne. Przebieg i wypadki w pełnym raporcie.",
    free_decoder_faq_1_q: "Czy działa dla BMW i Audi?",
    free_decoder_faq_1_a:
      "Tak. Niemieckie prefiksy WMI (WBA, WBS, WAU, WDD, WVW) są obsługiwane.",
    free_decoder_faq_2_q: "Czy to naprawdę za darmo?",
    free_decoder_faq_2_a:
      "Tak — rok, marka, model, silnik i cyfra kontrolna są darmowe. Bez subskrypcji.",
    free_decoder_faq_3_q: "Różnica względem pełnego raportu?",
    free_decoder_faq_3_a:
      "Dekoder = dane fabryczne. Raport = przebieg, wypadki, salvage i kradzież z baz danych.",
    free_decoder_seo_cta_title: "Dane fabryczne za darmo. Historia jednym kliknięciem.",
    free_decoder_seo_cta_desc:
      "Po dekodowaniu odblokuj przebieg, wypadki i status salvage — w kilka sekund.",
    free_decoder_seo_cta_btn: "Zobacz ceny raportu",
    free_decoder_example_try: "Wypróbuj przykładowy VIN",
  },
  ro: {
    free_decoder_seo_badge: "Ghid VIN",
    free_decoder_seo_title: "Decodor VIN gratuit pentru BMW, Audi, Mercedes și altele",
    free_decoder_seo_sub:
      "Decodați orice VIN de 17 caractere: an, marcă, model, motor și date de fabrică. Importuri germane, japoneze, americane și coreene — apoi kilometraj și accidente.",
    free_decoder_seo_how_title: "Cum funcționează decodorul VIN",
    free_decoder_seo_how_sub:
      "Fiecare număr de șasiu urmează standardul ISO 3779. Citim WMI, VDS și VIS instant.",
    free_decoder_seo_step_0_title: "Introduceți VIN-ul de 17 caractere",
    free_decoder_seo_step_0_desc:
      "Lipiți numărul de pe parbriz, ușă sau acte de înmatriculare.",
    free_decoder_seo_step_1_title: "WMI identifică marca",
    free_decoder_seo_step_1_desc:
      "Primele trei caractere: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT) etc.",
    free_decoder_seo_step_2_title: "VDS arată modelul și motorul",
    free_decoder_seo_step_2_desc:
      "Caracterele 4–9: linie model, caroserie, motor și sisteme de siguranță.",
    free_decoder_seo_step_3_title: "Deblocați istoricul",
    free_decoder_seo_step_3_desc:
      "Gratuit: date fabrică. Raport complet: kilometraj, accidente, salvage și furt verificate.",
    free_decoder_seo_brands_title: "Decodoare VIN pe marcă",
    free_decoder_seo_brands_sub:
      "Atingeți o marcă pentru un VIN exemplu — sau lipiți al vostru mai sus.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "Decodor VIN BMW",
    free_decoder_brand_bmw_desc:
      "Șasiuri BMW: Seria 3, 5, X5, M. WMI WBA, WBS, 5UX și fabrici DE/SUA.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Decodor VIN Audi",
    free_decoder_brand_audi_desc:
      "VIN Audi (WAU, TRU): A3, A4, A6, Q5, RS — model, motor și fabrică.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Decodor VIN Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): Clasa C, E, GLC, AMG — date fabrică din șasiu.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Decodor VIN Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, cod model și fabrică.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Decodor VIN Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — an, motor și origine.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Decodor VIN Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — date NHTSA pentru SUA și import.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Decodor VIN Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — an, cilindree și fabrică.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Decodor VIN Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — esențial înainte de import din Coreea.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Ce înseamnă fiecare parte a VIN-ului",
    free_decoder_seo_vin_desc:
      "VIN-ul nu e aleatoriu. Trei blocuri ajută să verificați mașina înainte de cumpărare.",
    free_decoder_seo_vin_wmi: "WMI — marcă și țară",
    free_decoder_seo_vin_vds: "VDS — model și motor",
    free_decoder_seo_vin_vis: "VIS — serie și an",
    free_decoder_seo_faq_badge: "Întrebări",
    free_decoder_seo_faq_title: "Întrebări despre decodorul VIN",
    free_decoder_faq_0_q: "Ce este un decodor VIN gratuit?",
    free_decoder_faq_0_a:
      "Citește numărul de 17 caractere și returnează date fabrică. Kilometrajul și accidentele necesită raportul complet.",
    free_decoder_faq_1_q: "Funcționează pentru BMW și Audi?",
    free_decoder_faq_1_a:
      "Da. Prefixele WMI germane (WBA, WBS, WAU, WDD, WVW) sunt suportate.",
    free_decoder_faq_2_q: "Este cu adevărat gratuit?",
    free_decoder_faq_2_a:
      "Da — an, marcă, model, motor și cifra de control sunt gratuite. Fără abonament.",
    free_decoder_faq_3_q: "Diferența față de raportul complet?",
    free_decoder_faq_3_a:
      "Decodor = date fabrică. Raport = kilometraj, accidente, salvage și furt din baze de date.",
    free_decoder_seo_cta_title: "Date fabrică gratuite. Istoric la un clic.",
    free_decoder_seo_cta_desc:
      "După decodare, deblocați kilometraj verificat, accidente și salvage — în câteva secunde.",
    free_decoder_seo_cta_btn: "Vezi prețurile raportului",
    free_decoder_example_try: "Încearcă un VIN exemplu",
  },
  bg: {
    free_decoder_seo_badge: "VIN ръководство",
    free_decoder_seo_title: "Безплатен VIN декодер за BMW, Audi, Mercedes и други",
    free_decoder_seo_sub:
      "Декодирайте всеки 17-цифрен VIN: година, марка, модел, двигател и заводски данни. Внос от Германия, Япония, САЩ и Корея — след това пробег и катастрофи.",
    free_decoder_seo_how_title: "Как работи VIN декодерът",
    free_decoder_seo_how_sub:
      "Всеки шасиен номер следва ISO 3779. Четем WMI, VDS и VIS мигновено.",
    free_decoder_seo_step_0_title: "Въведете 17-цифрен VIN",
    free_decoder_seo_step_0_desc:
      "Поставете номера от предното стъкло, вратата или документите.",
    free_decoder_seo_step_1_title: "WMI идентифицира марката",
    free_decoder_seo_step_1_desc:
      "Първите три знака: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT) и др.",
    free_decoder_seo_step_2_title: "VDS показва модел и двигател",
    free_decoder_seo_step_2_desc:
      "Знаци 4–9: моделна линия, каросерия, двигател и системи за безопасност.",
    free_decoder_seo_step_3_title: "Отключете историята",
    free_decoder_seo_step_3_desc:
      "Безплатно: заводски данни. Пълен отчет: пробег, катастрофи, salvage и кражба.",
    free_decoder_seo_brands_title: "VIN декодери по марка",
    free_decoder_seo_brands_sub:
      "Натиснете марка за примерен VIN — или поставете своя отгоре.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "BMW VIN декодер",
    free_decoder_brand_bmw_desc:
      "BMW шаси: Серия 3, 5, X5, M. WMI WBA, WBS, 5UX и заводи DE/US.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Audi VIN декодер",
    free_decoder_brand_audi_desc:
      "Audi VIN (WAU, TRU): A3, A4, A6, Q5, RS — модел, двигател и завод.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Mercedes VIN декодер",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): C, E, GLC, AMG — заводски данни от шасито.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Volkswagen VIN декодер",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, код и завод веднага.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Toyota VIN декодер",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — година, двигател и произход.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Ford VIN декодер",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — NHTSA данни за САЩ и внос.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Honda VIN декодер",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — година, обем и завод.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Hyundai VIN декодер",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — важно преди внос от Корея.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Какво означава всяка част от VIN",
    free_decoder_seo_vin_desc:
      "VIN не е случаен. Три блока помагат да проверите колата преди покупка.",
    free_decoder_seo_vin_wmi: "WMI — марка и държава",
    free_decoder_seo_vin_vds: "VDS — модел и двигател",
    free_decoder_seo_vin_vis: "VIS — серия и година",
    free_decoder_seo_faq_badge: "Въпроси",
    free_decoder_seo_faq_title: "Въпроси за VIN декодера",
    free_decoder_faq_0_q: "Какво е безплатен VIN декодер?",
    free_decoder_faq_0_a:
      "Чете 17-цифрения номер и връща заводски данни. Пробег и катастрофи изискват пълен отчет.",
    free_decoder_faq_1_q: "Работи ли за BMW и Audi?",
    free_decoder_faq_1_a:
      "Да. Немските WMI префикси (WBA, WBS, WAU, WDD, WVW) се поддържат.",
    free_decoder_faq_2_q: "Наистина ли е безплатно?",
    free_decoder_faq_2_a:
      "Да — година, марка, модел, двигател и контролна цифра са безплатни. Без абонамент.",
    free_decoder_faq_3_q: "Разлика с пълния отчет?",
    free_decoder_faq_3_a:
      "Декодер = заводски данни. Отчет = пробег, катастрофи, salvage и кражба от бази данни.",
    free_decoder_seo_cta_title: "Заводски данни безплатно. История с един клик.",
    free_decoder_seo_cta_desc:
      "След декодиране отключете пробег, катастрофи и salvage — за секунди.",
    free_decoder_seo_cta_btn: "Вижте цените на отчета",
    free_decoder_example_try: "Опитайте примерен VIN",
  },
  ar: {
    free_decoder_seo_badge: "دليل VIN",
    free_decoder_seo_title: "فك تشفير VIN مجاني لـ BMW وAudi وMercedes والمزيد",
    free_decoder_seo_sub:
      "فك أي رقم هيكل من 17 خانة: السنة والماركة والطراز والمحرك وبيانات المصنع. واردات ألمانية ويابانية وأمريكية وكورية — ثم افتح سجل المسافة والحوادث.",
    free_decoder_seo_how_title: "كيف يعمل فك تشفير VIN",
    free_decoder_seo_how_sub:
      "كل رقم هيكل يتبع معيار ISO 3779. نقرأ WMI وVDS وVIS فوراً.",
    free_decoder_seo_step_0_title: "أدخل VIN من 17 خانة",
    free_decoder_seo_step_0_desc:
      "الصق الرقم من الزجاج الأمامي أو الباب أو أوراق التسجيل.",
    free_decoder_seo_step_1_title: "WMI يحدد الماركة",
    free_decoder_seo_step_1_desc:
      "الأحرف الثلاثة الأولى: BMW (WBA/WBS)، Audi (WAU)، Mercedes (WDD)، Toyota (JT) وغيرها.",
    free_decoder_seo_step_2_title: "VDS يكشف الطراز والمحرك",
    free_decoder_seo_step_2_desc:
      "الأحرف 4–9: خط الطراز والهيكل والمحرك وأنظمة السلامة.",
    free_decoder_seo_step_3_title: "افتح السجل الكامل",
    free_decoder_seo_step_3_desc:
      "مجاناً: بيانات المصنع. التقرير الكامل: مسافة وحوادث وsalvage وسرقة موثقة.",
    free_decoder_seo_brands_title: "فك تشفير VIN حسب الماركة",
    free_decoder_seo_brands_sub:
      "اضغط على ماركة لتجربة VIN نموذجي — أو الصق رقمك أعلاه.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "فك تشفير VIN لـ BMW",
    free_decoder_brand_bmw_desc:
      "أرقام BMW: السلسلة 3 و5 وX5 وM. WMI WBA وWBS و5UX ومصانع ألمانيا/أمريكا.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "فك تشفير VIN لـ Audi",
    free_decoder_brand_audi_desc:
      "Audi (WAU, TRU): A3 وA4 وA6 وQ5 وRS — الطراز والمحرك والمصنع.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "فك تشفير VIN لـ Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): الفئة C وE وGLC وAMG — بيانات المصنع من الهيكل.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "فك تشفير VIN لـ Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf وPassat وTiguan وID — WMI ورمز الطراز والمصنع.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "فك تشفير VIN لـ Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry وCorolla وRAV4 — السنة والمحرك والمنشأ.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "فك تشفير VIN لـ Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150 وMustang وExplorer — بيانات NHTSA للولايات المتحدة والواردات.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "فك تشفير VIN لـ Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic وAccord وCR-V — السنة والسعة والمصنع.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "فك تشفير VIN لـ Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra وTucson وSanta Fe — مهم قبل الاستيراد من كوريا.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "ماذا تعني كل جزء من VIN",
    free_decoder_seo_vin_desc:
      "VIN ليس عشوائياً. ثلاثة أقسام تساعدك على التحقق من السيارة قبل الشراء.",
    free_decoder_seo_vin_wmi: "WMI — الماركة والبلد",
    free_decoder_seo_vin_vds: "VDS — الطراز والمحرك",
    free_decoder_seo_vin_vis: "VIS — الرقم التسلسلي والسنة",
    free_decoder_seo_faq_badge: "أسئلة",
    free_decoder_seo_faq_title: "أسئلة حول فك تشفير VIN",
    free_decoder_faq_0_q: "ما هو فك تشفير VIN المجاني؟",
    free_decoder_faq_0_a:
      "يقرأ رقم الهيكل من 17 خانة ويعيد بيانات المصنع. المسافة والحوادث في التقرير الكامل.",
    free_decoder_faq_1_q: "هل يعمل مع BMW وAudi؟",
    free_decoder_faq_1_a:
      "نعم. بادئات WMI الألمانية (WBA, WBS, WAU, WDD, WVW) مدعومة بالكامل.",
    free_decoder_faq_2_q: "هل هو مجاني حقاً؟",
    free_decoder_faq_2_a:
      "نعم — السنة والماركة والطراز والمحرك ورقم التحقق مجانية. بدون اشتراك.",
    free_decoder_faq_3_q: "الفرق عن التقرير الكامل؟",
    free_decoder_faq_3_a:
      "الفك = بيانات المصنع. التقرير = مسافة وحوادث وsalvage وسرقة من قواعد البيانات.",
    free_decoder_seo_cta_title: "بيانات المصنع مجاناً. السجل بنقرة واحدة.",
    free_decoder_seo_cta_desc:
      "بعد الفك، افتح المسافة الموثقة والحوادث وحالة salvage — خلال ثوانٍ.",
    free_decoder_seo_cta_btn: "عرض أسعار التقرير",
    free_decoder_example_try: "جرب VIN نموذجي",
  },
  uk: {
    free_decoder_seo_badge: "Довідник VIN",
    free_decoder_seo_title: "Безкоштовний VIN-декодер для BMW, Audi, Mercedes та інших",
    free_decoder_seo_sub:
      "Розшифруйте будь-який 17-значний VIN: рік, марка, модель, двигун і заводські дані. Імпорт з Німеччини, Японії, США та Кореї — потім пробіг і ДТП у повному звіті.",
    free_decoder_seo_how_title: "Як працює VIN-декодер",
    free_decoder_seo_how_sub:
      "Кожен номер кузова відповідає ISO 3779. Миттєво читаємо WMI, VDS і VIS.",
    free_decoder_seo_step_0_title: "Введіть 17-значний VIN",
    free_decoder_seo_step_0_desc:
      "Вставте номер з лобового скла, дверей або документів.",
    free_decoder_seo_step_1_title: "WMI визначає марку",
    free_decoder_seo_step_1_desc:
      "Перші три символи: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT) тощо.",
    free_decoder_seo_step_2_title: "VDS показує модель і двигун",
    free_decoder_seo_step_2_desc:
      "Символи 4–9: лінійка, кузов, двигун і системи безпеки.",
    free_decoder_seo_step_3_title: "Відкрийте історію",
    free_decoder_seo_step_3_desc:
      "Безкоштовно: заводські дані. Повний звіт: пробіг, ДТП, salvage і крадіжка.",
    free_decoder_seo_brands_title: "VIN-декодери за марками",
    free_decoder_seo_brands_sub:
      "Натисніть марку для прикладу VIN — або вставте свій номер вище.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "VIN-декодер BMW",
    free_decoder_brand_bmw_desc:
      "Шасі BMW: Серія 3, 5, X5, M. WMI WBA, WBS, 5UX і заводи DE/US.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "VIN-декодер Audi",
    free_decoder_brand_audi_desc:
      "Audi (WAU, TRU): A3, A4, A6, Q5, RS — модель, двигун і завод.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "VIN-декодер Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): C, E, GLC, AMG — заводські дані з VIN.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "VIN-декодер Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, код моделі й завод.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "VIN-декодер Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — рік, двигун і походження.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "VIN-декодер Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — дані NHTSA для США та імпорту.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "VIN-декодер Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — рік, об'єм і завод.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "VIN-декодер Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — важливо перед імпортом з Кореї.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Що означає кожна частина VIN",
    free_decoder_seo_vin_desc:
      "VIN не випадковий. Три блоки допомагають перевірити авто перед покупкою.",
    free_decoder_seo_vin_wmi: "WMI — марка й країна",
    free_decoder_seo_vin_vds: "VDS — модель і двигун",
    free_decoder_seo_vin_vis: "VIS — серія й рік",
    free_decoder_seo_faq_badge: "Питання",
    free_decoder_seo_faq_title: "Питання про VIN-декодер",
    free_decoder_faq_0_q: "Що таке безкоштовний VIN-декодер?",
    free_decoder_faq_0_a:
      "Читає 17-значний номер і повертає заводські дані. Пробіг і ДТП — у повному звіті.",
    free_decoder_faq_1_q: "Чи працює для BMW і Audi?",
    free_decoder_faq_1_a:
      "Так. Німецькі префікси WMI (WBA, WBS, WAU, WDD, WVW) підтримуються.",
    free_decoder_faq_2_q: "Це справді безкоштовно?",
    free_decoder_faq_2_a:
      "Так — рік, марка, модель, двигун і контрольна цифра безкоштовні. Без підписки.",
    free_decoder_faq_3_q: "Чим відрізняється від повного звіту?",
    free_decoder_faq_3_a:
      "Декодер = заводські дані. Звіт = пробіг, ДТП, salvage і крадіжка з баз даних.",
    free_decoder_seo_cta_title: "Заводські дані безкоштовно. Історія в один клік.",
    free_decoder_seo_cta_desc:
      "Після розшифрування відкрийте пробіг, ДТП і salvage — за кілька секунд.",
    free_decoder_seo_cta_btn: "Ціни повного звіту",
    free_decoder_example_try: "Спробувати приклад VIN",
  },
  ru: {
    free_decoder_seo_badge: "Справочник VIN",
    free_decoder_seo_title: "Бесплатный VIN-декодер для BMW, Audi, Mercedes и других",
    free_decoder_seo_sub:
      "Расшифруйте любой 17-значный VIN: год, марка, модель, двигатель и заводские данные. Импорт из Германии, Японии, США и Кореи — затем пробег и ДТП в полном отчёте.",
    free_decoder_seo_how_title: "Как работает VIN-декодер",
    free_decoder_seo_how_sub:
      "Каждый номер кузова соответствует ISO 3779. Мгновенно читаем WMI, VDS и VIS.",
    free_decoder_seo_step_0_title: "Введите 17-значный VIN",
    free_decoder_seo_step_0_desc:
      "Вставьте номер с лобового стекла, двери или документов.",
    free_decoder_seo_step_1_title: "WMI определяет марку",
    free_decoder_seo_step_1_desc:
      "Первые три символа: BMW (WBA/WBS), Audi (WAU), Mercedes (WDD), Toyota (JT) и др.",
    free_decoder_seo_step_2_title: "VDS показывает модель и двигатель",
    free_decoder_seo_step_2_desc:
      "Символы 4–9: линейка, кузов, двигатель и системы безопасности.",
    free_decoder_seo_step_3_title: "Откройте историю",
    free_decoder_seo_step_3_desc:
      "Бесплатно: заводские данные. Полный отчёт: пробег, ДТП, salvage и угон.",
    free_decoder_seo_brands_title: "VIN-декодеры по маркам",
    free_decoder_seo_brands_sub:
      "Нажмите марку для примера VIN — или вставьте свой номер выше.",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "VIN-декодер BMW",
    free_decoder_brand_bmw_desc:
      "Шасси BMW: Серия 3, 5, X5, M. WMI WBA, WBS, 5UX и заводы DE/US.",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "VIN-декодер Audi",
    free_decoder_brand_audi_desc:
      "Audi (WAU, TRU): A3, A4, A6, Q5, RS — модель, двигатель и завод.",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "VIN-декодер Mercedes",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG): C, E, GLC, AMG — заводские данные из VIN.",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "VIN-декодер Volkswagen",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW): Golf, Passat, Tiguan, ID — WMI, код модели и завод.",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "VIN-декодер Toyota",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD): Camry, Corolla, RAV4 — год, двигатель и происхождение.",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "VIN-декодер Ford",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT): F-150, Mustang, Explorer — данные NHTSA для США и импорта.",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "VIN-декодер Honda",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM): Civic, Accord, CR-V — год, объём и завод.",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "VIN-декодер Hyundai",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP): Elantra, Tucson, Santa Fe — важно перед импортом из Кореи.",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "Что означает каждая часть VIN",
    free_decoder_seo_vin_desc:
      "VIN не случаен. Три блока помогают проверить авто перед покупкой.",
    free_decoder_seo_vin_wmi: "WMI — марка и страна",
    free_decoder_seo_vin_vds: "VDS — модель и двигатель",
    free_decoder_seo_vin_vis: "VIS — серия и год",
    free_decoder_seo_faq_badge: "Вопросы",
    free_decoder_seo_faq_title: "Вопросы о VIN-декодере",
    free_decoder_faq_0_q: "Что такое бесплатный VIN-декодер?",
    free_decoder_faq_0_a:
      "Читает 17-значный номер и возвращает заводские данные. Пробег и ДТП — в полном отчёте.",
    free_decoder_faq_1_q: "Работает ли для BMW и Audi?",
    free_decoder_faq_1_a:
      "Да. Немецкие префиксы WMI (WBA, WBS, WAU, WDD, WVW) поддерживаются.",
    free_decoder_faq_2_q: "Это действительно бесплатно?",
    free_decoder_faq_2_a:
      "Да — год, марка, модель, двигатель и контрольная цифра бесплатны. Без подписки.",
    free_decoder_faq_3_q: "Чем отличается от полного отчёта?",
    free_decoder_faq_3_a:
      "Декодер = заводские данные. Отчёт = пробег, ДТП, salvage и угон из баз данных.",
    free_decoder_seo_cta_title: "Заводские данные бесплатно. История в один клик.",
    free_decoder_seo_cta_desc:
      "После расшифровки откройте пробег, ДТП и salvage — за несколько секунд.",
    free_decoder_seo_cta_btn: "Цены полного отчёта",
    free_decoder_example_try: "Попробовать пример VIN",
  },
  zh: {
    free_decoder_seo_badge: "VIN 指南",
    free_decoder_seo_title: "免费 VIN 解码器 — BMW、Audi、Mercedes 等品牌",
    free_decoder_seo_sub:
      "解码任意 17 位 VIN：年份、品牌、型号、发动机和出厂数据。适用于德国、日本、美国和韩国进口车 — 完整报告可解锁里程和事故记录。",
    free_decoder_seo_how_title: "VIN 解码器如何工作",
    free_decoder_seo_how_sub:
      "每个车架号遵循 ISO 3779 标准。我们即时读取 WMI、VDS 和 VIS。",
    free_decoder_seo_step_0_title: "输入 17 位 VIN",
    free_decoder_seo_step_0_desc:
      "从挡风玻璃、车门贴纸或登记文件粘贴车架号。",
    free_decoder_seo_step_1_title: "WMI 识别品牌",
    free_decoder_seo_step_1_desc:
      "前三位字符：BMW (WBA/WBS)、Audi (WAU)、Mercedes (WDD)、Toyota (JT) 等。",
    free_decoder_seo_step_2_title: "VDS 显示型号和发动机",
    free_decoder_seo_step_2_desc:
      "第 4–9 位：车系、车身、发动机和安全系统。",
    free_decoder_seo_step_3_title: "解锁完整历史",
    free_decoder_seo_step_3_desc:
      "免费：出厂数据。完整报告：已验证里程、事故、salvage 和盗抢记录。",
    free_decoder_seo_brands_title: "按品牌的 VIN 解码器",
    free_decoder_seo_brands_sub:
      "点击品牌试用示例 VIN — 或在上方粘贴您的 17 位号码。",
    free_decoder_brand_bmw_short: "BMW",
    free_decoder_brand_bmw_title: "BMW VIN 解码器",
    free_decoder_brand_bmw_desc:
      "BMW 车架号：3 系、5 系、X5、M 系列。WMI WBA、WBS、5UX 及德/美工厂。",
    free_decoder_brand_audi_short: "AUD",
    free_decoder_brand_audi_title: "Audi VIN 解码器",
    free_decoder_brand_audi_desc:
      "Audi VIN (WAU, TRU)：A3、A4、A6、Q5、RS — 型号、发动机和工厂。",
    free_decoder_brand_mercedes_short: "MB",
    free_decoder_brand_mercedes_title: "Mercedes VIN 解码器",
    free_decoder_brand_mercedes_desc:
      "Mercedes (WDD, WDB, 4JG)：C、E、GLC、AMG — 车架号出厂数据。",
    free_decoder_brand_volkswagen_short: "VW",
    free_decoder_brand_volkswagen_title: "Volkswagen VIN 解码器",
    free_decoder_brand_volkswagen_desc:
      "VW (WVW, 3VW)：Golf、Passat、Tiguan、ID — WMI、型号代码和工厂。",
    free_decoder_brand_toyota_short: "TOY",
    free_decoder_brand_toyota_title: "Toyota VIN 解码器",
    free_decoder_brand_toyota_desc:
      "Toyota/Lexus (JT, 5TD)：Camry、Corolla、RAV4 — 年份、发动机和产地。",
    free_decoder_brand_ford_short: "FOR",
    free_decoder_brand_ford_title: "Ford VIN 解码器",
    free_decoder_brand_ford_desc:
      "Ford/Lincoln (1FA, 1FT)：F-150、Mustang、Explorer — NHTSA 美国及进口数据。",
    free_decoder_brand_honda_short: "HON",
    free_decoder_brand_honda_title: "Honda VIN 解码器",
    free_decoder_brand_honda_desc:
      "Honda/Acura (1HG, JHM)：Civic、Accord、CR-V — 年份、排量和工厂。",
    free_decoder_brand_hyundai_short: "HY",
    free_decoder_brand_hyundai_title: "Hyundai VIN 解码器",
    free_decoder_brand_hyundai_desc:
      "Hyundai/Kia (KMH, 5NP)：Elantra、Tucson、Santa Fe — 韩国进口前必备。",
    free_decoder_seo_vin_badge: "ISO 3779",
    free_decoder_seo_vin_title: "VIN 各部分含义",
    free_decoder_seo_vin_desc:
      "VIN 并非随机。三个区块帮助您在购买前核实车辆信息。",
    free_decoder_seo_vin_wmi: "WMI — 品牌和国家",
    free_decoder_seo_vin_vds: "VDS — 型号和发动机",
    free_decoder_seo_vin_vis: "VIS — 序列号和年份",
    free_decoder_seo_faq_badge: "常见问题",
    free_decoder_seo_faq_title: "VIN 解码器常见问题",
    free_decoder_faq_0_q: "什么是免费 VIN 解码器？",
    free_decoder_faq_0_a:
      "读取 17 位车架号并返回出厂数据。里程和事故记录需完整报告。",
    free_decoder_faq_1_q: "支持 BMW 和 Audi 的 VIN 吗？",
    free_decoder_faq_1_a:
      "支持。德国 WMI 前缀 (WBA, WBS, WAU, WDD, WVW) 完全兼容。",
    free_decoder_faq_2_q: "真的免费吗？",
    free_decoder_faq_2_a:
      "是的 — 年份、品牌、型号、发动机和校验位免费。无需订阅。",
    free_decoder_faq_3_q: "与完整报告有何区别？",
    free_decoder_faq_3_a:
      "解码器 = 出厂数据。完整报告 = 数据库中的里程、事故、salvage 和盗抢。",
    free_decoder_seo_cta_title: "出厂数据免费。历史一键解锁。",
    free_decoder_seo_cta_desc:
      "解码后解锁已验证里程、事故和 salvage 状态 — 通常数秒内完成。",
    free_decoder_seo_cta_btn: "查看完整报告价格",
    free_decoder_example_try: "试用示例 VIN",
  },
};

const seoMore = {
  es: {
    title: "Decodificador VIN gratis — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Decodifique VIN 17 dígitos gratis. Decodificador BMW, Audi, Mercedes, Toyota. Año, marca, modelo — sin registro.",
  },
  fr: {
    title: "Décodeur VIN gratuit — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Décodez tout VIN 17 caractères gratuitement. BMW, Audi, Mercedes, Toyota. Année, marque, modèle — sans inscription.",
  },
  pl: {
    title: "Darmowy dekoder VIN — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Zdekoduj VIN 17 znaków za darmo. Dekoder BMW, Audi, Mercedes, Toyota. Rok, marka, model — bez rejestracji.",
  },
  ro: {
    title: "Decodor VIN gratuit — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Decodați VIN 17 caractere gratuit. Decodor BMW, Audi, Mercedes, Toyota. An, marcă, model — fără înregistrare.",
  },
  bg: {
    title: "Безплатен VIN декодер — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Декодирайте 17-цифрен VIN безплатно. BMW, Audi, Mercedes, Toyota. Година, марка, модел — без регистрация.",
  },
  ar: {
    title: "فك تشفير VIN مجاني — BMW وAudi وMercedes | verifykm.com",
    description:
      "فك أي VIN من 17 خانة مجاناً. BMW وAudi وMercedes وToyota. السنة والماركة والطراز — بدون تسجيل.",
  },
  uk: {
    title: "Безкоштовний VIN-декодер — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Розшифруйте 17-значний VIN безкоштовно. BMW, Audi, Mercedes, Toyota. Рік, марка, модель — без реєстрації.",
  },
  ru: {
    title: "Бесплатный VIN-декодер — BMW, Audi, Mercedes | verifykm.com",
    description:
      "Расшифруйте 17-значный VIN бесплатно. BMW, Audi, Mercedes, Toyota. Год, марка, модель — без регистрации.",
  },
  zh: {
    title: "免费 VIN 解码器 — BMW、Audi、Mercedes | verifykm.com",
    description:
      "免费解码 17 位 VIN。BMW、Audi、Mercedes、Toyota 解码器。年份、品牌、型号 — 无需注册。",
  },
};

Object.assign(data.i18n, more);
Object.assign(data.seo, seoMore);

fs.writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log("Added:", Object.keys(more).join(", "));
