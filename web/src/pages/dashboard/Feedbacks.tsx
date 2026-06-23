import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import FilterTabs, { TabItem } from "@/components/ui/FilterTabs";
import Table, { TableFilterDef } from "@/components/table/Table";
import { formatDate } from "@/utils/formats/formats";
import { debounce } from "lodash";
import {
  getSlideFeedbacks,
  getChapterReviews,
  getSectionReviews,
  getCourseReviews,
  getSystemReviews,
  exportReviews,
  getReviewsSummary,
} from "@/services/feedback.service";
import { StarIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/common/Button";
import ComboboxField from "@/components/common/form/ComboboxField";
import {
  ISlideFeedback,
  IChapterReview,
  ISectionReview,
  ICourseReview,
  ISystemReview,
} from "@/types";

export const Feedbacks: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState("slide");
  const [isExporting, setIsExporting] = useState(false);
  
  // Pagination and search states
  const [slideSearch, setSlideSearch] = useState("");
  const [chapterSearch, setChapterSearch] = useState("");
  const [sectionSearch, setSectionSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  
  const [slidePage, setSlidePage] = useState(1);
  const [chapterPage, setChapterPage] = useState(1);
  const [sectionPage, setSectionPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);
  const [systemPage, setSystemPage] = useState(1);

  // Filter states
  const [filters, setFilters] = useState({
    includeFeedbacks: true,
    includeSystemReviews: true,
    includeCourseReviews: true,
    includeSectionReviews: true,
    includeChapterReviews: true,
    district: "",
    sector: "",
    startDate: "",
    endDate: "",
  });

  // Rwanda Districts (30 districts)
  const districts = useMemo(() => [
    "Bugesera", "Burera", "Gakenke", "Gasabo", "Gatsibo", "Gicumbi", "Gisagara", "Huye",
    "Kamonyi", "Karongi", "Kayonza", "Kicukiro", "Kirehe", "Muhanga", "Musanze", "Ngoma", "Ngororero",
    "Nyabihu", "Nyagatare", "Nyamagabe", "Nyamasheke", "Nyanza", "Nyarugenge", "Nyaruguru",
    "Rubavu", "Ruhango", "Rulindo", "Rusizi", "Rutsiro", "Rwamagana"
  ], []);

  const districtOptions: { value: string; label: string }[] = useMemo(() => {
    return districts.map(district => ({
      value: district,
      label: district
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [districts]);

  const sectorOptions: { value: string; label: string }[] = useMemo(() => {
    const sectorsData = [
      // Bugesera District
      { sector: "Gashora", district: "Bugesera" },
      { sector: "Juru", district: "Bugesera" },
      { sector: "Kamabuye", district: "Bugesera" },
      { sector: "Ntarama", district: "Bugesera" },
      { sector: "Nyamata", district: "Bugesera" },
      { sector: "Nyarugenge", district: "Bugesera" },
      { sector: "Rilima", district: "Bugesera" },
      { sector: "Ruhuha", district: "Bugesera" },
      { sector: "Rweru", district: "Bugesera" },
      { sector: "Shyara", district: "Bugesera" },
      // Burera District
      { sector: "Bungwe", district: "Burera" },
      { sector: "Butaro", district: "Burera" },
      { sector: "Cyanika", district: "Burera" },
      { sector: "Cyeru", district: "Burera" },
      { sector: "Gahunga", district: "Burera" },
      { sector: "Gatebe", district: "Burera" },
      { sector: "Gitovu", district: "Burera" },
      { sector: "Kagogo", district: "Burera" },
      { sector: "Kinoni", district: "Burera" },
      { sector: "Kinyababa", district: "Burera" },
      { sector: "Kivuye", district: "Burera" },
      { sector: "Nemba", district: "Burera" },
      { sector: "Rugarama", district: "Burera" },
      { sector: "Rugendabari", district: "Burera" },
      { sector: "Ruhunde", district: "Burera" },
      { sector: "Rusarabu", district: "Burera" },
      { sector: "Rwerere", district: "Burera" },
      // Gakenke District
      { sector: "Busengo", district: "Gakenke" },
      { sector: "Coko", district: "Gakenke" },
      { sector: "Cyabingo", district: "Gakenke" },
      { sector: "Gakenke", district: "Gakenke" },
      { sector: "Gashenyi", district: "Gakenke" },
      { sector: "Mugunga", district: "Gakenke" },
      { sector: "Janja", district: "Gakenke" },
      { sector: "Kamubuga", district: "Gakenke" },
      { sector: "Karambo", district: "Gakenke" },
      { sector: "Kivuruga", district: "Gakenke" },
      { sector: "Mataba", district: "Gakenke" },
      { sector: "Minazi", district: "Gakenke" },
      { sector: "Muhondo", district: "Gakenke" },
      { sector: "Muyongwe", district: "Gakenke" },
      { sector: "Nemba", district: "Gakenke" },
      { sector: "Ruli", district: "Gakenke" },
      { sector: "Rusasa", district: "Gakenke" },
      { sector: "Rushashi", district: "Gakenke" },
      { sector: "Rushyashya", district: "Gakenke" },
      // Gasabo District
      { sector: "Bumbogo", district: "Gasabo" },
      { sector: "Gatsata", district: "Gasabo" },
      { sector: "Gikomero", district: "Gasabo" },
      { sector: "Gisozi", district: "Gasabo" },
      { sector: "Jabana", district: "Gasabo" },
      { sector: "Jali", district: "Gasabo" },
      { sector: "Kacyiru", district: "Gasabo" },
      { sector: "Kimihurura", district: "Gasabo" },
      { sector: "Kimisagara", district: "Gasabo" },
      { sector: "Kinyinya", district: "Gasabo" },
      { sector: "Ndera", district: "Gasabo" },
      { sector: "Nduba", district: "Gasabo" },
      { sector: "Remera", district: "Gasabo" },
      { sector: "Rusororo", district: "Gasabo" },
      { sector: "Rutunga", district: "Gasabo" },
      // Gatsibo District
      { sector: "Gasange", district: "Gatsibo" },
      { sector: "Gatsibo", district: "Gatsibo" },
      { sector: "Gitoki", district: "Gatsibo" },
      { sector: "Kageyo", district: "Gatsibo" },
      { sector: "Kiramuruzi", district: "Gatsibo" },
      { sector: "Kiziguro", district: "Gatsibo" },
      { sector: "Muhura", district: "Gatsibo" },
      { sector: "Murambi", district: "Gatsibo" },
      { sector: "Ngarama", district: "Gatsibo" },
      { sector: "Nyagihanga", district: "Gatsibo" },
      { sector: "Remera", district: "Gatsibo" },
      { sector: "Rugarama", district: "Gatsibo" },
      { sector: "Rwimbogo", district: "Gatsibo" },
      // Gicumbi District
      { sector: "Bukure", district: "Gicumbi" },
      { sector: "Bwisige", district: "Gicumbi" },
      { sector: "Byumba", district: "Gicumbi" },
      { sector: "Cyumba", district: "Gicumbi" },
      { sector: "Gicumbi", district: "Gicumbi" },
      { sector: "Kaniga", district: "Gicumbi" },
      { sector: "Manyagiro", district: "Gicumbi" },
      { sector: "Miyove", district: "Gicumbi" },
      { sector: "Kageyo", district: "Gicumbi" },
      { sector: "Mukarange", district: "Gicumbi" },
      { sector: "Muko", district: "Gicumbi" },
      { sector: "Mutete", district: "Gicumbi" },
      { sector: "Nyamiyaga", district: "Gicumbi" },
      { sector: "Nyankenke", district: "Gicumbi" },
      { sector: "Rubaya", district: "Gicumbi" },
      { sector: "Rukomo", district: "Gicumbi" },
      { sector: "Rushaki", district: "Gicumbi" },
      { sector: "Rutare", district: "Gicumbi" },
      { sector: "Ruvune", district: "Gicumbi" },
      { sector: "Rwamiko", district: "Gicumbi" },
      { sector: "Shangasha", district: "Gicumbi" },
      // Gisagara District
      { sector: "Gikonko", district: "Gisagara" },
      { sector: "Gishubi", district: "Gisagara" },
      { sector: "Kansi", district: "Gisagara" },
      { sector: "Kibirizi", district: "Gisagara" },
      { sector: "Kigembe", district: "Gisagara" },
      { sector: "Mukindo", district: "Gisagara" },
      { sector: "Musha", district: "Gisagara" },
      { sector: "Ndora", district: "Gisagara" },
      { sector: "Nyanza", district: "Gisagara" },
      { sector: "Save", district: "Gisagara" },
      { sector: "Rweru", district: "Gisagara" },
      // Huye District
      { sector: "Gishamvu", district: "Huye" },
      { sector: "Karama", district: "Huye" },
      { sector: "Kigoma", district: "Huye" },
      { sector: "Kinazi", district: "Huye" },
      { sector: "Maraba", district: "Huye" },
      { sector: "Mbazi", district: "Huye" },
      { sector: "Mukura", district: "Huye" },
      { sector: "Ngoma", district: "Huye" },
      { sector: "Ruhashya", district: "Huye" },
      { sector: "Rusatira", district: "Huye" },
      { sector: "Rwaniro", district: "Huye" },
      { sector: "Simbi", district: "Huye" },
      { sector: "Tumba", district: "Huye" },
      // Kamonyi District
      { sector: "Gacurabwenge", district: "Kamonyi" },
      { sector: "Karama", district: "Kamonyi" },
      { sector: "Kayenzi", district: "Kamonyi" },
      { sector: "Kayumbu", district: "Kamonyi" },
      { sector: "Mugina", district: "Kamonyi" },
      { sector: "Musambira", district: "Kamonyi" },
      { sector: "Ngamba", district: "Kamonyi" },
      { sector: "Nyamiyaga", district: "Kamonyi" },
      { sector: "Nyarubaka", district: "Kamonyi" },
      { sector: "Runda", district: "Kamonyi" },
      { sector: "Ruzo", district: "Kamonyi" },
      // Karongi District
      { sector: "Bwishyura", district: "Karongi" },
      { sector: "Gashari", district: "Karongi" },
      { sector: "Gitesi", district: "Karongi" },
      { sector: "Gishyita", district: "Karongi" },
      { sector: "Gisunzu", district: "Karongi" },
      { sector: "Kivumu", district: "Karongi" },
      { sector: "Mubuga", district: "Karongi" },
      { sector: "Murambi", district: "Karongi" },
      { sector: "Rugabano", district: "Karongi" },
      { sector: "Ruganda", district: "Karongi" },
      { sector: "Rusizi", district: "Karongi" },
      { sector: "Rwankuba", district: "Karongi" },
      // Kicukiro District
      { sector: "Gahanga", district: "Kicukiro" },
      { sector: "Gatenga", district: "Kicukiro" },
      { sector: "Gikondo", district: "Kicukiro" },
      { sector: "Kanombe", district: "Kicukiro" },
      { sector: "Kagarama", district: "Kicukiro" },
      { sector: "Masaka", district: "Kicukiro" },
      { sector: "Niboye", district: "Kicukiro" },
      // Kirehe District
      { sector: "Gahara", district: "Kirehe" },
      { sector: "Gatore", district: "Kirehe" },
      { sector: "Jarama", district: "Kirehe" },
      { sector: "Kigina", district: "Kirehe" },
      { sector: "Kirehe", district: "Kirehe" },
      { sector: "Mahama", district: "Kirehe" },
      { sector: "Mpanga", district: "Kirehe" },
      { sector: "Mushikiri", district: "Kirehe" },
      { sector: "Nasho", district: "Kirehe" },
      { sector: "Nyamugali", district: "Kirehe" },
      { sector: "Nyarubuye", district: "Kirehe" },
      // Muhanga District
      { sector: "Cyeza", district: "Muhanga" },
      { sector: "Kabacuzi", district: "Muhanga" },
      { sector: "Kibangu", district: "Muhanga" },
      { sector: "Kiyumba", district: "Muhanga" },
      { sector: "Muhanga", district: "Muhanga" },
      { sector: "Mukura", district: "Muhanga" },
      { sector: "Mushishiro", district: "Muhanga" },
      { sector: "Nyamabuye", district: "Muhanga" },
      { sector: "Nyabinoni", district: "Muhanga" },
      { sector: "Rugendabari", district: "Muhanga" },
      { sector: "Ruyumba", district: "Muhanga" },
      { sector: "Shyogwe", district: "Muhanga" },
      // Musanze District
      { sector: "Busogo", district: "Musanze" },
      { sector: "Cyuve", district: "Musanze" },
      { sector: "Gacaca", district: "Musanze" },
      { sector: "Gashaki", district: "Musanze" },
      { sector: "Gataraga", district: "Musanze" },
      { sector: "Kimonyi", district: "Musanze" },
      { sector: "Kinigi", district: "Musanze" },
      { sector: "Muhoza", district: "Musanze" },
      { sector: "Muko", district: "Musanze" },
      { sector: "Musanze", district: "Musanze" },
      { sector: "Nkotsi", district: "Musanze" },
      { sector: "Nyange", district: "Musanze" },
      { sector: "Remera", district: "Musanze" },
      { sector: "Rwaza", district: "Musanze" },
      { sector: "Shingiro", district: "Musanze" },
      // Ngoma District
      { sector: "Gashanda", district: "Ngoma" },
      { sector: "Jarama", district: "Ngoma" },
      { sector: "Karembo", district: "Ngoma" },
      { sector: "Kibungo", district: "Ngoma" },
      { sector: "Mugesera", district: "Ngoma" },
      { sector: "Mutenderi", district: "Ngoma" },
      { sector: "Remera", district: "Ngoma" },
      { sector: "Rukira", district: "Ngoma" },
      { sector: "Rukumberi", district: "Ngoma" },
      { sector: "Rurenge", district: "Ngoma" },
      { sector: "Sake", district: "Ngoma" },
      { sector: "Zaza", district: "Ngoma" },
      // Ngororero District
      { sector: "Bwira", district: "Ngororero" },
      { sector: "Gatumba", district: "Ngororero" },
      { sector: "Hindiro", district: "Ngororero" },
      { sector: "Kageyo", district: "Ngororero" },
      { sector: "Kavumu", district: "Ngororero" },
      { sector: "Matyazo", district: "Ngororero" },
      { sector: "Muhanda", district: "Ngororero" },
      { sector: "Muhororo", district: "Ngororero" },
      { sector: "Ndaro", district: "Ngororero" },
      { sector: "Ngororero", district: "Ngororero" },
      { sector: "Nyange", district: "Ngororero" },
      { sector: "Sovu", district: "Ngororero" },
      // Nyabihu District
      { sector: "Bigogwe", district: "Nyabihu" },
      { sector: "Jenda", district: "Nyabihu" },
      { sector: "Jomba", district: "Nyabihu" },
      { sector: "Kabatwa", district: "Nyabihu" },
      { sector: "Karago", district: "Nyabihu" },
      { sector: "Kintobo", district: "Nyabihu" },
      { sector: "Mukamira", district: "Nyabihu" },
      { sector: "Nyabihu", district: "Nyabihu" },
      { sector: "Rambura", district: "Nyabihu" },
      { sector: "Rugera", district: "Nyabihu" },
      { sector: "Rurembo", district: "Nyabihu" },
      { sector: "Shyira", district: "Nyabihu" },
      // Nyagatare District
      { sector: "Gatunda", district: "Nyagatare" },
      { sector: "Karangazi", district: "Nyagatare" },
      { sector: "Katabagemu", district: "Nyagatare" },
      { sector: "Kiyombe", district: "Nyagatare" },
      { sector: "Matimba", district: "Nyagatare" },
      { sector: "Mimuli", district: "Nyagatare" },
      { sector: "Mukama", district: "Nyagatare" },
      { sector: "Musheri", district: "Nyagatare" },
      { sector: "Nyagatare", district: "Nyagatare" },
      { sector: "Rukomo", district: "Nyagatare" },
      { sector: "Rwempasha", district: "Nyagatare" },
      { sector: "Rwimiyaga", district: "Nyagatare" },
      { sector: "Tabagwe", district: "Nyagatare" },
      // Nyamagabe District
      { sector: "Buruhukiro", district: "Nyamagabe" },
      { sector: "Cyanika", district: "Nyamagabe" },
      { sector: "Gasaka", district: "Nyamagabe" },
      { sector: "Gatare", district: "Nyamagabe" },
      { sector: "Kaduha", district: "Nyamagabe" },
      { sector: "Kamegeri", district: "Nyamagabe" },
      { sector: "Kibirizi", district: "Nyamagabe" },
      { sector: "Kibumbwe", district: "Nyamagabe" },
      { sector: "Kitabi", district: "Nyamagabe" },
      { sector: "Mbazi", district: "Nyamagabe" },
      { sector: "Mushubi", district: "Nyamagabe" },
      { sector: "Musange", district: "Nyamagabe" },
      { sector: "Nkomane", district: "Nyamagabe" },
      { sector: "Tare", district: "Nyamagabe" },
      { sector: "Uwinkingi", district: "Nyamagabe" },
      // Nyamasheke District
      { sector: "Bushekeri", district: "Nyamasheke" },
      { sector: "Bushenge", district: "Nyamasheke" },
      { sector: "Cyato", district: "Nyamasheke" },
      { sector: "Gihombo", district: "Nyamasheke" },
      { sector: "Kagano", district: "Nyamasheke" },
      { sector: "Kanjongo", district: "Nyamasheke" },
      { sector: "Karengera", district: "Nyamasheke" },
      { sector: "Karambi", district: "Nyamasheke" },
      { sector: "Macuba", district: "Nyamasheke" },
      { sector: "Mahembe", district: "Nyamasheke" },
      { sector: "Ruharambuga", district: "Nyamasheke" },
      { sector: "Ruragwe", district: "Nyamasheke" },
      { sector: "Bushyiru", district: "Nyamasheke" },
      { sector: "Rangiro", district: "Nyamasheke" },
      // Nyanza District
      { sector: "Busasamana", district: "Nyanza" },
      { sector: "Busoro", district: "Nyanza" },
      { sector: "Cyabakamyi", district: "Nyanza" },
      { sector: "Kibirizi", district: "Nyanza" },
      { sector: "Kigoma", district: "Nyanza" },
      { sector: "Mukingo", district: "Nyanza" },
      { sector: "Muyira", district: "Nyanza" },
      { sector: "Ntyazo", district: "Nyanza" },
      { sector: "Nyagisozi", district: "Nyanza" },
      { sector: "Rwabicuma", district: "Nyanza" },
      // Nyarugenge District
      { sector: "Gitega", district: "Nyarugenge" },
      { sector: "Kanyinya", district: "Nyarugenge" },
      { sector: "Kigali", district: "Nyarugenge" },
      { sector: "Kimisagara", district: "Nyarugenge" },
      { sector: "Mageragere", district: "Nyarugenge" },
      { sector: "Muhima", district: "Nyarugenge" },
      { sector: "Nyakabanda", district: "Nyarugenge" },
      { sector: "Nyamirambo", district: "Nyarugenge" },
      { sector: "Nyarugenge", district: "Nyarugenge" },
      { sector: "Rwezamenyo", district: "Nyarugenge" },
      // Nyaruguru District
      { sector: "Busanze", district: "Nyaruguru" },
      { sector: "Cyahinda", district: "Nyaruguru" },
      { sector: "Kibeho", district: "Nyaruguru" },
      { sector: "Kibumbwe", district: "Nyaruguru" },
      { sector: "Kivu", district: "Nyaruguru" },
      { sector: "Mata", district: "Nyaruguru" },
      { sector: "Munini", district: "Nyaruguru" },
      { sector: "Ngera", district: "Nyaruguru" },
      { sector: "Ngoma", district: "Nyaruguru" },
      { sector: "Nyabimata", district: "Nyaruguru" },
      { sector: "Nyagisozi", district: "Nyaruguru" },
      { sector: "Ruheru", district: "Nyaruguru" },
      { sector: "Rusenge", district: "Nyaruguru" },
      { sector: "Rwaniro", district: "Nyaruguru" },
      // Rubavu District
      { sector: "Bugeshi", district: "Rubavu" },
      { sector: "Busasamana", district: "Rubavu" },
      { sector: "Cyanzarwe", district: "Rubavu" },
      { sector: "Gisenyi", district: "Rubavu" },
      { sector: "Kanama", district: "Rubavu" },
      { sector: "Kanzenze", district: "Rubavu" },
      { sector: "Mudende", district: "Rubavu" },
      { sector: "Nyakiliba", district: "Rubavu" },
      { sector: "Nyamyumba", district: "Rubavu" },
      { sector: "Rubavu", district: "Rubavu" },
      { sector: "Rugerero", district: "Rubavu" },
      // Ruhango District
      { sector: "Bweramana", district: "Ruhango" },
      { sector: "Byimana", district: "Ruhango" },
      { sector: "Kinazi", district: "Ruhango" },
      { sector: "Kinihira", district: "Ruhango" },
      { sector: "Muhanga", district: "Ruhango" },
      { sector: "Mwendo", district: "Ruhango" },
      { sector: "Nyarusange", district: "Ruhango" },
      { sector: "Ruhango", district: "Ruhango" },
      { sector: "Rwabuhanga", district: "Ruhango" },
      { sector: "Rusatira", district: "Ruhango" },
      // Rulindo District
      { sector: "Base", district: "Rulindo" },
      { sector: "Burega", district: "Rulindo" },
      { sector: "Bushoki", district: "Rulindo" },
      { sector: "Cyinzuzi", district: "Rulindo" },
      { sector: "Cyungo", district: "Rulindo" },
      { sector: "Kinihira", district: "Rulindo" },
      { sector: "Kisaro", district: "Rulindo" },
      { sector: "Mbogo", district: "Rulindo" },
      { sector: "Munyaga", district: "Rulindo" },
      { sector: "Ngoma", district: "Rulindo" },
      { sector: "Ntarabana", district: "Rulindo" },
      { sector: "Rukozo", district: "Rulindo" },
      { sector: "Rusiga", district: "Rulindo" },
      { sector: "Shyorongi", district: "Rulindo" },
      { sector: "Tumba", district: "Rulindo" },
      // Rusizi District
      { sector: "Butare", district: "Rusizi" },
      { sector: "Bugarama", district: "Rusizi" },
      { sector: "Bukavu", district: "Rusizi" },
      { sector: "Gashonga", district: "Rusizi" },
      { sector: "Gikundamvura", district: "Rusizi" },
      { sector: "Gisuma", district: "Rusizi" },
      { sector: "Gihundwe", district: "Rusizi" },
      { sector: "Kamembe", district: "Rusizi" },
      { sector: "Muganza", district: "Rusizi" },
      { sector: "Mururu", district: "Rusizi" },
      { sector: "Nkanka", district: "Rusizi" },
      { sector: "Nkombo", district: "Rusizi" },
      { sector: "Nyakabuye", district: "Rusizi" },
      { sector: "Nyakarenzo", district: "Rusizi" },
      { sector: "Nzahaha", district: "Rusizi" },
      { sector: "Rwimbogo", district: "Rusizi" },
      // Rutsiro District
      { sector: "Boneza", district: "Rutsiro" },
      { sector: "Gihango", district: "Rutsiro" },
      { sector: "Kigeyo", district: "Rutsiro" },
      { sector: "Kivumu", district: "Rutsiro" },
      { sector: "Manihira", district: "Rutsiro" },
      { sector: "Mukura", district: "Rutsiro" },
      { sector: "Musasa", district: "Rutsiro" },
      { sector: "Mushonyi", district: "Rutsiro" },
      { sector: "Mushubati", district: "Rutsiro" },
      { sector: "Nyabirasi", district: "Rutsiro" },
      { sector: "Ruhango", district: "Rutsiro" },
      { sector: "Rusebeya", district: "Rutsiro" },
      // Rwamagana District
      { sector: "Fumbwe", district: "Rwamagana" },
      { sector: "Gahengeri", district: "Rwamagana" },
      { sector: "Gishari", district: "Rwamagana" },
      { sector: "Karenge", district: "Rwamagana" },
      { sector: "Kigabiro", district: "Rwamagana" },
      { sector: "Muhazi", district: "Rwamagana" },
      { sector: "Munyaga", district: "Rwamagana" },
      { sector: "Munyiginya", district: "Rwamagana" },
      { sector: "Musha", district: "Rwamagana" },
      { sector: "Muyumbu", district: "Rwamagana" },
      { sector: "Nzige", district: "Rwamagana" },
      { sector: "Nyakariro", district: "Rwamagana" },
      { sector: "Rubona", district: "Rwamagana" },
      { sector: "Rurenge", district: "Rwamagana" },
      // Kayonza District (missing from previous list)
      { sector: "Bugesera", district: "Kayonza" },
      { sector: "Bweru", district: "Kayonza" },
      { sector: "Gahini", district: "Kayonza" },
      { sector: "Kabarore", district: "Kayonza" },
      { sector: "Kinunga", district: "Kayonza" },
      { sector: "Mugesera", district: "Kayonza" },
      { sector: "Murama", district: "Kayonza" },
      { sector: "Mwiri", district: "Kayonza" },
      { sector: "Nyamirama", district: "Kayonza" },
      { sector: "Nyarubaka", district: "Kayonza" },
      { sector: "Rukira", district: "Kayonza" },
      { sector: "Rwinkwavu", district: "Kayonza" }
    ];

    return sectorsData.map(item => ({
      value: item.sector, // Only sector name for API
      label: `${item.sector}(${item.district})` // Display format with district
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Build query parameters helper
  const buildQueryParams = (page: number, keyword?: string) => {
    const params = new URLSearchParams();
    if (page > 1) params.append('page', page.toString());
    if (keyword) params.append('searchq', keyword);
    
    // Add filter parameters
    if (filters.district) params.append('district', filters.district);
    if (filters.sector) params.append('sector', filters.sector);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    // Add include parameters
    params.append('includeFeedbacks', filters.includeFeedbacks.toString());
    params.append('includeSystemReviews', filters.includeSystemReviews.toString());
    params.append('includeCourseReviews', filters.includeCourseReviews.toString());
    params.append('includeSectionReviews', filters.includeSectionReviews.toString());
    params.append('includeChapterReviews', filters.includeChapterReviews.toString());
    
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  };

  // Export data function — exports all selected chip types as separate sheets in one workbook
  const exportData = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const params = new URLSearchParams();

      // Send each chip's current selected state directly
      params.append('includeFeedbacks', filters.includeFeedbacks.toString());
      params.append('includeChapterReviews', filters.includeChapterReviews.toString());
      params.append('includeSectionReviews', filters.includeSectionReviews.toString());
      params.append('includeCourseReviews', filters.includeCourseReviews.toString());
      params.append('includeSystemReviews', filters.includeSystemReviews.toString());

      // Pass active location/date filter parameters
      if (filters.district) params.append('district', filters.district);
      if (filters.sector) params.append('sector', filters.sector);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      // Build filename from which chips are selected
      const selected: string[] = [];
      if (filters.includeFeedbacks) selected.push('slides');
      if (filters.includeChapterReviews) selected.push('chapters');
      if (filters.includeSectionReviews) selected.push('sections');
      if (filters.includeCourseReviews) selected.push('courses');
      if (filters.includeSystemReviews) selected.push('system');
      const typePart = selected.length === 5 ? 'all-reviews' : selected.join('-');
      const filename = `${typePart}-${new Date().toISOString().split('T')[0]}.xlsx`;

      const blob = await exportReviews(`?${params.toString()}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const tabItems: TabItem[] = [
    { key: "slide", label: "Slide Review" },
    { key: "chapter", label: "Chapter Review" },
    { key: "section", label: "Section Review" },
    { key: "course", label: "Course Review" },
    { key: "system", label: "System Review" },
  ];

  // Queries for each review type with backend pagination
  const { data: slideFeedbacks, isLoading: slideLoading } = useQuery({
    queryKey: ["slide-feedbacks", slidePage, slideSearch, filters],
    queryFn: () => getSlideFeedbacks(buildQueryParams(slidePage, slideSearch)),
    enabled: selectedTab === "slide",
  });

  const { data: chapterReviews, isLoading: chapterLoading } = useQuery({
    queryKey: ["chapter-reviews", chapterPage, chapterSearch, filters],
    queryFn: () => getChapterReviews(buildQueryParams(chapterPage, chapterSearch)),
    enabled: selectedTab === "chapter",
  });

  const { data: sectionReviews, isLoading: sectionLoading } = useQuery({
    queryKey: ["section-reviews", sectionPage, sectionSearch, filters],
    queryFn: () => getSectionReviews(buildQueryParams(sectionPage, sectionSearch)),
    enabled: selectedTab === "section",
  });

  const { data: courseReviews, isLoading: courseLoading } = useQuery({
    queryKey: ["course-reviews", coursePage, courseSearch, filters],
    queryFn: () => getCourseReviews(buildQueryParams(coursePage, courseSearch)),
    enabled: selectedTab === "course",
  });

  const { data: systemReviews, isLoading: systemLoading } = useQuery({
    queryKey: ["system-reviews", systemPage, systemSearch, filters],
    queryFn: () => getSystemReviews(buildQueryParams(systemPage, systemSearch)),
    enabled: selectedTab === "system",
  });

  // Summary query
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["reviews-summary"],
    queryFn: () => getReviewsSummary(),
  });

  const handleTabChange = (tabKey: string) => {
    setSelectedTab(tabKey);
  };

  // Stats cards component
  const renderStatsCards = () => {
    if (summaryLoading || !summaryData?.data?.summary) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow border animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }

    const { summary, totalRecords } = summaryData.data;
    const statsCards = [
      {
        title: "Total Records",
        value: totalRecords.toLocaleString(),
        color: "bg-blue-500",
        textColor: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        title: "Slide Feedbacks",
        value: summary.feedbacks.toLocaleString(),
        color: "bg-green-500",
        textColor: "text-green-600",
        bgColor: "bg-green-50",
      },
      {
        title: "Chapter Reviews",
        value: summary.chapterReviews.toLocaleString(),
        color: "bg-purple-500",
        textColor: "text-purple-600",
        bgColor: "bg-purple-50",
      },
      {
        title: "Section Reviews",
        value: summary.sectionReviews.toLocaleString(),
        color: "bg-orange-500",
        textColor: "text-orange-600",
        bgColor: "bg-orange-50",
      },
      {
        title: "Course Reviews",
        value: summary.courseReviews.toLocaleString(),
        color: "bg-indigo-500",
        textColor: "text-indigo-600",
        bgColor: "bg-indigo-50",
      },
      {
        title: "System Reviews",
        value: summary.systemReviews.toLocaleString(),
        color: "bg-red-500",
        textColor: "text-red-600",
        bgColor: "bg-red-50",
      },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statsCards.map((card, index) => (
          <div key={index} className={`${card.bgColor} p-4 rounded-lg shadow-sm border border-gray-200`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                  {card.title}
                </p>
                <p className={`text-2xl font-bold ${card.textColor} mt-1`}>
                  {card.value}
                </p>
              </div>
              <div className={`w-3 h-3 ${card.color} rounded-full`}></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Filter handlers
  const handleFilterChange = useCallback((key: string, value: string | boolean) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      
      // Handle mutual exclusivity between district and sector
      if (key === 'district' && value) {
        newFilters.sector = ""; // Clear sector when district is selected
      } else if (key === 'sector' && value) {
        newFilters.district = ""; // Clear district when sector is selected
      }
      
      return newFilters;
    });
    
    // Reset pagination when filters change
    setSlidePage(1);
    setChapterPage(1);
    setSectionPage(1);
    setCoursePage(1);
    setSystemPage(1);
  }, []);

  const clearFilters = () => {
    setFilters({
      includeFeedbacks: true,
      includeSystemReviews: true,
      includeCourseReviews: true,
      includeSectionReviews: true,
      includeChapterReviews: true,
      district: "",
      sector: "",
      startDate: "",
      endDate: "",
    });
  };

  // Shared inline filters for all tabs
  const sharedFilters: TableFilterDef[] = useMemo(() => [
    {
      key: "district",
      label: "District",
      value: filters.district,
      onChange: (val: string) => handleFilterChange("district", val),
      renderFilter: (
        <ComboboxField
          options={[{ value: "", label: "All Districts" }, ...districtOptions]}
          defaultValue={filters.district}
          onChange={(val) => handleFilterChange("district", val)}
          hideQueryOnChange={false}
          placeholder="District..."
          margin={false}
        />
      ),
    },
    {
      key: "sector",
      label: "Sector",
      value: filters.sector,
      onChange: (val: string) => handleFilterChange("sector", val),
      renderFilter: (
        <ComboboxField
          options={[{ value: "", label: "All Sectors" }, ...sectorOptions]}
          defaultValue={filters.sector}
          onChange={(val) => handleFilterChange("sector", val)}
          hideQueryOnChange={false}
          placeholder="Sector..."
          margin={false}
        />
      ),
    },
    {
      key: "startDate",
      label: "From",
      type: "date" as const,
      value: filters.startDate,
      onChange: (val: string) => handleFilterChange("startDate", val),
    },
    {
      key: "endDate",
      label: "To",
      type: "date" as const,
      value: filters.endDate,
      onChange: (val: string) => handleFilterChange("endDate", val),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [filters.district, filters.sector, filters.startDate, filters.endDate, districtOptions, sectorOptions]);

  const reviewTypePills = useMemo(() => (
    <div className="flex flex-wrap items-center gap-1.5">
      {([
        { key: "includeFeedbacks", label: "Slides" },
        { key: "includeChapterReviews", label: "Chapters" },
        { key: "includeSectionReviews", label: "Sections" },
        { key: "includeCourseReviews", label: "Courses" },
        { key: "includeSystemReviews", label: "System" },
      ] as { key: keyof typeof filters; label: string }[]).map(({ key, label }) => (
        <label
          key={key}
          className={`flex items-center px-2 py-1 rounded-full text-xs cursor-pointer transition-all ${
            filters[key]
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "bg-gray-100 text-gray-500 border border-gray-200"
          }`}
        >
          <input
            type="checkbox"
            checked={filters[key] as boolean}
            onChange={(e) => handleFilterChange(key, e.target.checked)}
            className="sr-only"
          />
          <span className="font-medium">{label}</span>
        </label>
      ))}
    </div>
  ), [filters, handleFilterChange]);

  const exportBtn = (
    <Button variant="outline" size="sm" onClick={() => exportData()} disabled={isExporting}>
      {isExporting ? "Exporting..." : "Export"}
    </Button>
  );

  // Search handlers with debounce
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSlideSearch = useCallback(
    debounce((searchTerm: string) => {
      setSlideSearch(searchTerm);
      setSlidePage(1);
    }, 500),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleChapterSearch = useCallback(
    debounce((searchTerm: string) => {
      setChapterSearch(searchTerm);
      setChapterPage(1);
    }, 500),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSectionSearch = useCallback(
    debounce((searchTerm: string) => {
      setSectionSearch(searchTerm);
      setSectionPage(1);
    }, 500),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleCourseSearch = useCallback(
    debounce((searchTerm: string) => {
      setCourseSearch(searchTerm);
      setCoursePage(1);
    }, 500),
    []
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSystemSearch = useCallback(
    debounce((searchTerm: string) => {
      setSystemSearch(searchTerm);
      setSystemPage(1);
    }, 500),
    []
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex text-yellow-500">
        {[...Array(5)].map((_, i) => (
          <StarIcon key={i} className={`w-4 h-4 ${i < rating ? "text-yellow-500" : "text-gray-300"}`} />
        ))}
      </div>
    );
  };

  const renderSlideReviews = () => {
    return (
      <Table
        isLoading={slideLoading}
        currentPage={slideFeedbacks?.currentPage || 1}
        totalItems={slideFeedbacks?.totalItems || 0}
        itemsPerPage={slideFeedbacks?.itemsPerPage || 15}
        onChangePage={setSlidePage}
        headerComponent={reviewTypePills}
        searchFun={handleSlideSearch}
        filters={sharedFilters}
        onResetFilters={clearFilters}
        actionBtn={exportBtn}
        columns={[
        {
          title: "User",
          key: "user",
          render: (row: ISlideFeedback) => (
            <div className="flex items-center gap-2">
              <img
                src={row.user.photo}
                alt={row.user.fullNames}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="font-medium">{row.user.fullNames}</span>
            </div>
          ),
        },
        {
          title: "Course",
          key: "course",
          render: (row: ISlideFeedback) => (
            <div className="max-w-xs truncate" title={row.slide.chapter.section.course.title}>
              {row.slide.chapter.section.course.title}
            </div>
          ),
        },
        {
          title: "Section",
          key: "section",
          render: (row: ISlideFeedback) => (
            <div className="max-w-xs truncate" title={row.slide.chapter.section.title}>
              {row.slide.chapter.section.title}
            </div>
          ),
        },
        {
          title: "Chapter",
          key: "chapter",
          render: (row: ISlideFeedback) => (
            <div className="max-w-xs truncate" title={row.slide.chapter.title}>
              {row.slide.chapter.title}
            </div>
          ),
        },
        {
          title: "Slide",
          key: "slide",
          render: (row: ISlideFeedback) => (
            <span className="text-sm">Slide #{row.slide.slideNumber}</span>
          ),
        },
        {
          title: "Message",
          key: "message",
          render: (row: ISlideFeedback) => (
            <div className="max-w-md truncate" title={row.message}>
              {row.message}
            </div>
          ),
        },
        {
          title: "Status",
          key: "status",
          render: (row: ISlideFeedback) => (
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                row.isPublished
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {row.isPublished ? "Published" : "Draft"}
            </span>
          ),
        },
        {
          title: "Date",
          key: "date",
          render: (row: ISlideFeedback) => (
            <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
          ),
        },
      ]}
      data={slideFeedbacks?.data || []}
    />
  );
  };

  const renderChapterReviews = () => {
    return (
      <Table
        isLoading={chapterLoading}
        currentPage={chapterReviews?.currentPage || 1}
        totalItems={chapterReviews?.totalItems || 0}
        itemsPerPage={chapterReviews?.itemsPerPage || 15}
        onChangePage={setChapterPage}
        headerComponent={reviewTypePills}
        searchFun={handleChapterSearch}
        filters={sharedFilters}
        onResetFilters={clearFilters}
        actionBtn={exportBtn}
        columns={[
        {
          title: "CHW",
          key: "student",
          render: (row: IChapterReview) => (
            <div className="flex items-center gap-2">
              <img
                src={row.student.user.photo}
                alt={row.student.user.fullNames}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="font-medium">{row.student.user.fullNames}</span>
            </div>
          ),
        },
        {
          title: "Chapter",
          key: "chapter",
          render: (row: IChapterReview) => (
            <div className="max-w-xs truncate" title={row.chapter.title}>
              {row.chapter.title}
            </div>
          ),
        },
        {
          title: "Rating",
          key: "rating",
          render: (row: IChapterReview) => renderStars(row.rating),
        },
        {
          title: "Comment",
          key: "comment",
          render: (row: IChapterReview) => (
            <div className="max-w-md truncate" title={row.comment}>
              {row.comment || "No comment"}
            </div>
          ),
        },
        {
          title: "Categories",
          key: "categories",
          render: (row: IChapterReview) => (
            <span className="text-sm text-gray-600">
              {row.categoryRatings.length} ratings
            </span>
          ),
        },
        {
          title: "Date",
          key: "date",
          render: (row: IChapterReview) => (
            <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
          ),
        },
      ]}
      data={chapterReviews?.data || []}
    />
  );
  };

  const renderSectionReviews = () => {
    return (
      <Table
        isLoading={sectionLoading}
        currentPage={sectionReviews?.currentPage || 1}
        totalItems={sectionReviews?.totalItems || 0}
        itemsPerPage={sectionReviews?.itemsPerPage || 15}
        onChangePage={setSectionPage}
        headerComponent={reviewTypePills}
        searchFun={handleSectionSearch}
        filters={sharedFilters}
        onResetFilters={clearFilters}
        actionBtn={exportBtn}
        columns={[
        {
          title: "CHW",
          key: "student",
          render: (row: ISectionReview) => (
            <div className="flex items-center gap-2">
              <img
                src={row.student.user.photo}
                alt={row.student.user.fullNames}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="font-medium">{row.student.user.fullNames}</span>
            </div>
          ),
        },
        {
          title: "Section",
          key: "section",
          render: (row: ISectionReview) => (
            <div className="max-w-xs truncate" title={row.section.title}>
              {row.section.title}
            </div>
          ),
        },
        {
          title: "Rating",
          key: "rating",
          render: (row: ISectionReview) => renderStars(row.rating),
        },
        {
          title: "Comment",
          key: "comment",
          render: (row: ISectionReview) => (
            <div className="max-w-md truncate" title={row.comment}>
              {row.comment || "No comment"}
            </div>
          ),
        },
        {
          title: "Categories",
          key: "categories",
          render: (row: ISectionReview) => (
            <span className="text-sm text-gray-600">
              {row.categoryRatings.length} ratings
            </span>
          ),
        },
        {
          title: "Date",
          key: "date",
          render: (row: ISectionReview) => (
            <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
          ),
        },
      ]}
      data={sectionReviews?.data || []}
    />
  );
  };

  const renderCourseReviews = () => {
    return (
      <Table
        isLoading={courseLoading}
        currentPage={courseReviews?.currentPage || 1}
        totalItems={courseReviews?.totalItems || 0}
        itemsPerPage={courseReviews?.itemsPerPage || 15}
        onChangePage={setCoursePage}
        headerComponent={reviewTypePills}
        searchFun={handleCourseSearch}
        filters={sharedFilters}
        onResetFilters={clearFilters}
        actionBtn={exportBtn}
        columns={[
        {
          title: "CHW",
          key: "student",
          render: (row: ICourseReview) => (
            <div className="flex items-center gap-2">
              <img
                src={row.student.user.photo}
                alt={row.student.user.fullNames}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="font-medium">{row.student.user.fullNames}</span>
            </div>
          ),
        },
        {
          title: "Course",
          key: "course",
          render: (row: ICourseReview) => (
            <div className="flex items-center gap-2">
              <img
                src={row.course.coverIcon}
                alt={row.course.title}
                className="w-10 h-10 rounded object-cover"
              />
              <div className="max-w-xs truncate" title={row.course.title}>
                {row.course.title}
              </div>
            </div>
          ),
        },
        {
          title: "Rating",
          key: "rating",
          render: (row: ICourseReview) => renderStars(row.rating),
        },
        {
          title: "Comment",
          key: "comment",
          render: (row: ICourseReview) => (
            <div className="max-w-md truncate" title={row.comment}>
              {row.comment || "No comment"}
            </div>
          ),
        },
        {
          title: "Categories",
          key: "categories",
          render: (row: ICourseReview) => (
            <span className="text-sm text-gray-600">
              {row.categoryRatings.length} ratings
            </span>
          ),
        },
        {
          title: "Date",
          key: "date",
          render: (row: ICourseReview
            
          ) => (
            <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
          ),
        },
      ]}
      data={courseReviews?.data || []}
    />
  );
  };

  const renderSystemReviews = () => {
    return (
      <Table
        isLoading={systemLoading}
        currentPage={systemReviews?.currentPage || 1}
        totalItems={systemReviews?.totalItems || 0}
        itemsPerPage={systemReviews?.itemsPerPage || 15}
        onChangePage={setSystemPage}
        headerComponent={reviewTypePills}
        searchFun={handleSystemSearch}
        filters={sharedFilters}
        onResetFilters={clearFilters}
        actionBtn={exportBtn}
        columns={[
        {
          title: "User",
          key: "user",
          render: (row: ISystemReview) => (
            <div className="flex items-center gap-2">
              <img
                src={row.user.photo}
                alt={row.user.fullNames}
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="font-medium">{row.user.fullNames}</span>
            </div>
          ),
        },
        {
          title: "Overall Rating",
          key: "rating",
          render: (row: ISystemReview) => renderStars(row.overallRating),
        },
        {
          title: "Feedback",
          key: "feedback",
          render: (row: ISystemReview) => (
            <div className="max-w-md truncate" title={row.feedback}>
              {row.feedback}
            </div>
          ),
        },
        {
          title: "Recommendation",
          key: "recommendation",
          render: (row: ISystemReview) => (
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                row.recommendation === "yes"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {row.recommendation === "yes" ? "Yes" : "No"}
            </span>
          ),
        },
        {
          title: "Categories",
          key: "categories",
          render: (row: ISystemReview) => (
            <span className="text-sm text-gray-600">
              {row.categoryRatings.length} ratings
            </span>
          ),
        },
        {
          title: "Date",
          key: "date",
          render: (row: ISystemReview) => (
            <div className="text-sm text-gray-600">{formatDate(row.createdAt)}</div>
          ),
        },
      ]}
      data={systemReviews?.data || []}
    />
  );
  };

  const renderContent = () => {
    switch (selectedTab) {
      case "slide":
        return renderSlideReviews();
      case "chapter":
        return renderChapterReviews();
      case "section":
        return renderSectionReviews();
      case "course":
        return renderCourseReviews();
      case "system":
        return renderSystemReviews();
      default:
        return renderSlideReviews();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-[#333333]">Feedbacks & Reviews</h2>
          <p className="text-base text-gray-500">
            Manage and review feedback from chw
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {renderStatsCards()}

      <FilterTabs
        items={tabItems}
        activeTab={selectedTab}
        onTabChange={handleTabChange}
        variant="default"
      />

      <div className="bg-white rounded-lg shadow">{renderContent()}</div>
    </div>
  );
};

export default Feedbacks;
