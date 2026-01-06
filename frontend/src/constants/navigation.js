import dashboardIcon from "../assets/Dashboard.svg";
import minutesIcon from "../assets/PresentationChart.svg";
import studentIcon from "../assets/UsersThree.svg";
import inventoryIcon from "../assets/Truck.svg";
import divisionalIcon from "../assets/Newspaper1.svg";
import customerIcon from "../assets/customer.svg";
import trainingIcon from "../assets/reports.svg";
import technicalIcon from "../assets/Report3.svg";
import settingsIcon from "../assets/GearFine.svg";
import usersIcon from "../assets/UsersThree.svg";
import digitalLibIcon from "../assets/digital.svg";
import calculatorIcon from "../assets/Calculator.svg";
import Currency from "../assets/Currency.svg";

export const ROLE_MENUS = {
  ADMIN: [
    { path: "/admin", label: "Dashboard", icon: dashboardIcon, end: true },
    { path: "/admin/users", label: "User Management", icon: usersIcon },
    { path: "/admin/settings", label: "Settings", icon: settingsIcon },
  ],
  GD: [
    { path: "/app", label: "Dashboard Overview", icon: dashboardIcon, end: true },
    { path: "/app/minutes", label: "Minutes of the Meeting", icon: minutesIcon },
    { path: "/app/student-engagement", label: "Student Engagement", icon: studentIcon },
    { path: "/app/inventory-records", label: "Procurement Records", icon: inventoryIcon },
    { path: "/app/budget-estimation", label: "Budget Estimation", icon: Currency },
    { path: "/app/divisional-records", label: "Divisional Records", icon: divisionalIcon },
    { path: "/app/customer-feedbacks", label: "Customer Feedbacks", icon: customerIcon },
    { path: "/app/training-records", label: "Training Records", icon: trainingIcon },
    { path: "/app/technical-reports", label: "Technical Reports", icon: technicalIcon },
    { path: "/app/digital-library", label: "Digital Library", icon: digitalLibIcon },
    { path: "/app/setting", label: "Settings", icon: settingsIcon },
  ],
};

ROLE_MENUS.DH = ROLE_MENUS.GD;

export const PAGE_META = {
  "/app": { title: "Welcome!", subtitle: "" },
  "/app/minutes": {
    title: "Minutes of the Meeting",
    subtitle: "Upload, manage, and track meeting minutes with task assignments",
  },
  "/app/student-engagement": { title: "Student Engagement", subtitle: "Description here" },
  "/app/inventory-records": { title: "Procurement Records", subtitle: "Description here" },
  "/app/budget-estimation": { title: "Budget Estimation", subtitle: "Description here" },
  "/app/divisional-records": {
    title: "Divisional Records",
    subtitle: "Keep budgets, AMC, and cyber updates aligned with documentation.",
  },
  "/app/customer-feedbacks": {
    title: "Customer Feedbacks Overview",
    subtitle: "Description here",
  },
  "/app/training-records": { title: "Training Records", subtitle: "Description here" },
  "/app/technical-reports": {
    title: "Technical & Design Reports",
    subtitle: "Manage your technical and design documentation",
  },
  "/app/digital-library": {
    title: "Digital Library",
    subtitle: "Browse and manage your stored documents",
  },
  "/app/setting": { title: "Settings", subtitle: "" },
  "/admin": { title: "Dashboard", subtitle: "Admin" },
  "/admin/users": { title: "User Management", subtitle: "" },
  
  "/app/settings": { 
    title: "Settings jjkn", 
    subtitle: "In this section, you can manage your account settings", 
  },
};

export const DEFAULT_PAGE_META = { title: "Dashboard", subtitle: "" };
