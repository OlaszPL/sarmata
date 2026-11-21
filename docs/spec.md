Aplikacja ma być zrezalizowana jako monorepo webappka, ważne informacje.

1. Jeżeli używasz pythona kiedykolwiek, to rób to przez uv.
2. Używaj tylko pnpm, pnpx, nigdy npm i innego czegoś - zawsze pnpm!
3. Aplikacja to będzie NextJS + React + TS.
4. Co do bazy danych to będziemy mieć migracje tutaj w repo i skorzystamy z supabase odpalanego na lokalnym dockerze (ale nazwij kontenery inaczej niż te co je mam obecnie odpalane) - jakiś skrypt na setup wszystkiego w repo by nie robić tego za każdym razem/
5. Bezpieczeństwo zrealizujemy przez SOPS, masz do tego skilla to se ogarniesz.
6. Do testów turborepo by nie tracić czasu, masz do tego skilla.
7. Struktura repo to wiesz, osobno backend (service functions), osobno front, osobno migracje z bazy, osobno docsy itp.
8. Co do pnpm dawaj jakieś skrypty typu pnpm build, pnpm dev itp itp, by nie trzeba było powtarzać w nieskończoność.

Co do UI, będziemy go realizować z wykorzystaniem:

1. Pencil MCP do projektowania niektórych stron, przed implementacją.
2. Używamy głównie i przede wszystkim komponentów z shadcn, radix-ui - rób tak, że je importujesz z cli, a potem wrappujesz w nasze komponenty jak coś chcesz modyfikować, by nie psuć zależności i tego jak to działa.
3. UI ma być kolorach służby cywilnej, polski gov, ma być elegancki ale funkcjonalny. Ofc jakieś logo czy branding służby cywilnej mile widziane.
4. Do testów skonfiguruj se playwrighta ze skryptami tak aby potem nie replikować akcji w nieskońcozność, najlepiej zaklep se skilla do przeklikiwania, którego będziesz iteracyjnie sobie poprawiał.
5. Ikonki z lucide-react.

Logowanie itp:
1. Wszytsko bazujemy na tym co daje nam lokalny supabase, jest compliant itp, dobre RLSy skonfigurowane i tak dalej i tak dalej.
2. Logownaie też robimy z wykorzystaniem supabase auth.
3. Wszystko stawiamy na supabase i to tak by łatwo było podmienić czy to lokalna instancja, czy się podłącza jakąś zewnętrzną.
4. Co do supabase to dobra struktura i relacje table, ale też feel free by używać jsonb pól, nie ma problemu.
5. Do takiej walidacji używaj zoda - ogl gdzie by się przydało używaj zoda.

Aplikacja:
1. Ideą jest to, że ma ona być "łatwa" w instalacji, więc powinna mieć jakieś gui (może być cli odpalane w bat/sh) tak by działało i na windows i na unix dowolnym i aby pozwalało na możliwości konfiguracji pod sprzęt, wersja light na słaby sprzęt, pojedyncz urządzenia (i to prowadzi za rączę w instalacji dockera itp), wersja lepsza na serwer. Każda opcja potem robi skrót na pulpicie (na systemach co to wspierają) dla potem łatwego odpalenia.
2. Ma być łatwa możliwość aktualizacji, cokolwiek to znaczy.
3. Głównie desktiop, ale jakby się skalowało to miło.
4. Te wymagania co oni w general-info dali to fajnie jakby były w ogólności spełnione.
5. Apka ma być responsywna, szybka, optymalne zapytania do bazy, łączone często w jedne, cache na froncie itp itp.


Co do HR AI, nie możesz korzystać raczej z api, muszą być lokalne modele, więc:

1. Bielik
2. Bielik One (jev-like)
3. Wybór rozmiaru model i czy wgl są modele na etapie instalacji i konfiguracji, nwm odpalanie przez llmama.cpp samo powinno wykrywać czy możemy odpalać na CUDA czy na CPU i do kiedy ma to sens, itp, ma być mindlesss w deploymencie.

Co do reszty ustaleń:
1. Zasady muszą być modułowe (bazujemy na ustawach z general-info, ale jest napisane wprost, że się mogą w niedługim czasie zmienić), może konfiguracja jako jakiś graf wizualizowany, gdzie można przepinać, przełączać reguły, zmienić stałe, niech wymyśli wszystkie przypadki, jak się to może zmienić i jak najlepiej dać możliwości konfiguracji.
2. Stare wyniki ewaluacji jako diagram schodzący w dół + np. bielik one jako analizwa wypalenia zawodowego z progresji pomiędzy ewaluacjami i może jakichś innych rzeczy ważnych w analizie pracowniczej?
3. Nie zakładamy hierarchii pracowniczej, bo różne urzędy mają inne. Po prostu użytkownik zapisuje, każdy widzi dostęp historii ewaluacji bo nie ma w tych urzędach ustalonej hierarchhi itp. Kto zapisuje to brane jest z konta użytkownika, a kogo loguje to sobie go wpisuje jego dane - i potem się to matchuje po tym co tam jest w tych wnioskach, ale pamiętaj, że to może być zmienne.


Nie wiem możesz rozplanować na mikroserwisy jak trzeba, ale na pewno NextJS z backendem w monorepo niech będzie, inne rzeczy się będą po jakimś grpc czy rest komuniktować - co uznasz za najwydajniesze.


WAŻNE
Dodaj precommit i pre-push, jakiś prosty CI, ale aby nie szedł jakoś mega długo i sensowne testowanie gdzie się da, korzystając z nowoczesnych pakietów itp.

Zarządzaj też fajnie configiem do termica: https://github.com/simion/termic/ by automatycznie można było robić nowe chaty itp.