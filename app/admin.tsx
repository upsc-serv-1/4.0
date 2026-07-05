import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Switch,
} from 'react-native';
import {
  ShieldCheck,
  Users,
  Key,
  CreditCard,
  RefreshCw,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  Settings,
  Sparkles,
  Activity,
  FileText,
  Calendar,
  Lock,
  ChevronRight,
  UserCheck,
  Database,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { useTheme } from '../src/context/ThemeContext';
import { supabase } from '../src/lib/supabase';
import { useAccessControl } from '../src/context/AccessControlContext';

const ADMIN_EMAILS = [
  'your@email.com',
  'aiimsmbbs17@gmail.com',
  'dn.d.n.g.zm.s.n.f.smb.t@gmail.com',
  'upsc-serv-1@proton.me',
];

type TabType = 'users' | 'features' | 'plans' | 'config';

export default function AdminScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { refresh: refreshPermissions } = useAccessControl();

  const userEmail = session?.user?.email?.toLowerCase() || '';
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Summary Stats
  const [stats, setStats] = useState({
    usersCount: 0,
    plansCount: 0,
    featuresCount: 0,
    subsCount: 0,
  });

  // --- Users Tab State ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Selected User Subscriptions & Stats
  const [userSub, setUserSub] = useState<any>(null);
  const [userOverrides, setUserOverrides] = useState<any[]>([]);
  const [userStats, setUserStats] = useState({
    reviews: 0,
    attempts: 0,
    notes: 0,
    sessions: 0,
  });
  const [loadingUserDetails, setLoadingUserDetails] = useState(false);
  
  // User Edit form state
  const [selectedPlanIdForUser, setSelectedPlanIdForUser] = useState<string>('free');
  const [subExpiresAt, setSubExpiresAt] = useState<string>('');
  const [subIsActive, setSubIsActive] = useState<boolean>(true);
  const [subNotes, setSubNotes] = useState<string>('');
  const [savingSub, setSavingSub] = useState(false);

  // User Permissions JSON State
  const [userPermissionsJson, setUserPermissionsJson] = useState<string>('{}');
  const [savingPermissions, setSavingPermissions] = useState(false);

  // --- Features Tab State ---
  const [featuresList, setFeaturesList] = useState<any[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featureModalVisible, setFeatureModalVisible] = useState(false);
  const [editingFeature, setEditingFeature] = useState<any>(null);
  const [featForm, setFeatForm] = useState({
    key: '',
    name: '',
    description: '',
    category: 'feature', // 'feature' | 'institute' | 'course' | 'test'
    is_active: true,
    sort_order: 0,
  });

  // --- Plans Tab State ---
  const [plansList, setPlansList] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: '0',
    currency: 'INR',
    interval: 'month', // 'month' | 'year' | 'lifetime' | 'one_time'
    is_active: true,
    sort_order: 0,
  });

  // Selected Plan Mappings
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>({});
  const [planInstitutes, setPlanInstitutes] = useState<string[]>([]);
  const [planCourses, setPlanCourses] = useState<string[]>([]);
  const [newInstName, setNewInstName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');

  // Course access lists (populated from DB)
  const [availableCourses, setAvailableCourses] = useState<string[]>(['Civil Services', 'Medical Science']);
  const [availableInstitutes, setAvailableInstitutes] = useState<string[]>(['VisionIAS', 'Vajiram & Ravi', 'ForumIAS', 'InsightIAS', 'IASbaba']);
  
  // Pickers Visibility
  const [instPickerVisible, setInstPickerVisible] = useState(false);
  const [planCoursePickerVisible, setPlanCoursePickerVisible] = useState(false);
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);

  // User-specific course access states
  const [subCourseName, setSubCourseName] = useState<string>('Civil Services');
  const [userAllowedCourses, setUserAllowedCourses] = useState<string[]>([]);

  // --- Global Config State ---
  const [paywallBypassActive, setPaywallBypassActive] = useState(false);
  const [announcementBannerText, setAnnouncementBannerText] = useState('Welcome to Dr. UPSC! Pro Plans are now live.');
  const [announcementBannerType, setAnnouncementBannerType] = useState('info');
  const [announcementBannerActive, setAnnouncementBannerActive] = useState(false);
  const [savingGlobalConfig, setSavingGlobalConfig] = useState(false);

  // --- Security Guard & Stats Check ---
  useEffect(() => {
    async function verifyAdmin() {
      if (!session?.user) {
        setCheckingAuth(false);
        return;
      }

      // Check if email in ADMIN_EMAILS
      const hasEmailAdmin = ADMIN_EMAILS.includes(userEmail);
      
      // Also check if isAdmin is set in user_settings table
      let hasDbAdmin = false;
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('permissions')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data?.permissions && typeof data.permissions === 'object') {
          const perms = data.permissions as any;
          if (perms.isAdmin === true) {
            hasDbAdmin = true;
          }
        }
      } catch (e) {
        console.error('Error checking user_settings admin flag:', e);
      }

      const verified = hasEmailAdmin || hasDbAdmin;
      setIsAdmin(verified);
      setCheckingAuth(false);

      if (verified) {
        fetchStats();
        fetchAvailableCoursesAndInstitutes();
        loadTabContent(activeTab);
      }
    }

    verifyAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, userEmail]);

  // Load Tab Content dynamically
  useEffect(() => {
    if (isAdmin) {
      loadTabContent(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin]);

  const loadTabContent = (tab: TabType) => {
    switch (tab) {
      case 'users':
        fetchUsers();
        fetchPlans();
        fetchFeatures();
        break;
      case 'features':
        fetchFeatures();
        break;
      case 'plans':
        fetchPlans();
        break;
      case 'config':
        fetchGlobalConfig();
        break;
    }
  };

  // --- Fetch Summary Stats ---
  const fetchStats = async () => {
    try {
      // Run quick count aggregates (using exact count since estimated can fail under RLS)
      const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: plansCount } = await supabase.from('access_plans').select('*', { count: 'exact', head: true });
      const { count: featuresCount } = await supabase.from('access_features').select('*', { count: 'exact', head: true });
      const { count: subsCount } = await supabase.from('user_subscriptions').select('*', { count: 'exact', head: true });

      setStats({
        usersCount: usersCount || 0,
        plansCount: plansCount || 0,
        featuresCount: featuresCount || 0,
        subsCount: subsCount || 0,
      });
    } catch (e) {
      console.error('Stats fetch error:', e);
    }
  };

  const fetchAvailableCoursesAndInstitutes = async () => {
    try {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('name');
      const coursesList = (coursesData || []).map((c: any) => c.name);
      const uniqueCourses = Array.from(new Set(['Civil Services', 'Medical Science', ...coursesList])).filter(Boolean);
      setAvailableCourses(uniqueCourses);

      const { data: testsData } = await supabase
        .from('tests')
        .select('institute')
        .not('institute', 'is', null);
      const testsInsts = (testsData || []).map((t: any) => t.institute);
      const defaultInsts = ['VisionIAS', 'Vajiram & Ravi', 'ForumIAS', 'InsightIAS', 'IASbaba', 'NextIAS', 'Sleepy Classes', 'OnlyIAS'];
      const uniqueInsts = Array.from(new Set([...defaultInsts, ...testsInsts])).filter(Boolean) as string[];
      setAvailableInstitutes(uniqueInsts);
    } catch (e) {
      console.error('Error fetching courses/institutes:', e);
    }
  };

  // --- TAB 1: USERS FUNCTIONS ---
  const fetchUsers = async (search = userSearch) => {
    setUsersLoading(true);
    try {
      // 1. Fetch from public.users table
      let usersQuery = supabase.from('users').select('id, email, created_at');
      if (search.trim()) {
        usersQuery = usersQuery.ilike('email', `%${search.trim()}%`);
      }
      const { data: usersData } = await usersQuery.order('email').limit(50);

      // 2. Fetch from user_settings table to merge display names and capture settings-only users
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('user_id, display_name, full_name');
      
      const settingsMap = new Map<string, any>();
      (settingsData || []).forEach(s => {
        settingsMap.set(s.user_id, s);
      });

      // 3. Fetch user IDs from user_subscriptions to ensure all subscribers are represented
      const { data: subsData } = await supabase.from('user_subscriptions').select('user_id');
      const subUserIds = new Set<string>((subsData || []).map(s => s.user_id));

      const mergedUsersMap = new Map<string, any>();

      // Add users from users table
      (usersData || []).forEach(u => {
        const s = settingsMap.get(u.id);
        mergedUsersMap.set(u.id, {
          id: u.id,
          email: u.email || `ID: ${u.id.slice(0, 8)}... (No Email)`,
          created_at: u.created_at,
          display_name: s?.display_name || s?.full_name || '',
        });
      });

      // Add any additional users found in settings that match search filter
      settingsMap.forEach((s, userId) => {
        if (!mergedUsersMap.has(userId)) {
          const matchSearch = !search.trim() || 
            userId.toLowerCase().includes(search.toLowerCase()) ||
            (s.display_name && s.display_name.toLowerCase().includes(search.toLowerCase())) ||
            (s.full_name && s.full_name.toLowerCase().includes(search.toLowerCase()));

          if (matchSearch) {
            mergedUsersMap.set(userId, {
              id: userId,
              email: `ID: ${userId.slice(0, 8)}...`,
              created_at: null,
              display_name: s.display_name || s.full_name || '',
            });
          }
        }
      });

      // Add any additional users found in subscriptions that match search filter
      subUserIds.forEach(userId => {
        if (!mergedUsersMap.has(userId)) {
          const matchSearch = !search.trim() || userId.toLowerCase().includes(search.toLowerCase());
          if (matchSearch) {
            const s = settingsMap.get(userId);
            mergedUsersMap.set(userId, {
              id: userId,
              email: `ID: ${userId.slice(0, 8)}...`,
              created_at: null,
              display_name: s?.display_name || s?.full_name || '',
            });
          }
        }
      });

      setUsersList(Array.from(mergedUsersMap.values()));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load users: ' + e.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const selectUser = async (user: any) => {
    setSelectedUser(user);
    setLoadingUserDetails(true);
    try {
      // 1. Fetch Subscriptions (including course_name)
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('id, plan_id, is_active, expires_at, created_at, notes, course_name')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserSub(subData);
      if (subData) {
        setSelectedPlanIdForUser(subData.plan_id);
        setSubExpiresAt(subData.expires_at ? new Date(subData.expires_at).toISOString().split('T')[0] : '');
        setSubIsActive(subData.is_active);
        setSubNotes(subData.notes || '');
        setSubCourseName(subData.course_name || 'Civil Services');
      } else {
        setSelectedPlanIdForUser('free');
        setSubExpiresAt('');
        setSubIsActive(true);
        setSubNotes('');
        setSubCourseName('Civil Services');
      }

      // 2. Fetch Overrides
      const { data: ovData } = await supabase
        .from('user_feature_overrides')
        .select('feature_key, is_granted, reason')
        .eq('user_id', user.id);
      setUserOverrides(ovData || []);

      // 3. Fetch User Settings / Permissions
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('permissions')
        .eq('user_id', user.id)
        .maybeSingle();

      setUserPermissionsJson(settingsData?.permissions ? JSON.stringify(settingsData.permissions, null, 2) : '{}');
      if (settingsData?.permissions && typeof settingsData.permissions === 'object') {
        const perms = settingsData.permissions as any;
        setUserAllowedCourses(Array.isArray(perms.allowedCourses) ? perms.allowedCourses : []);
      } else {
        setUserAllowedCourses([]);
      }

      // 4. Fetch User Stats (Parallel)
      const [reviewsRes, attemptsRes, notesRes, sessionsRes] = await Promise.all([
        supabase.from('card_reviews').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('test_attempts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('user_notes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('study_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      setUserStats({
        reviews: reviewsRes.count || 0,
        attempts: attemptsRes.count || 0,
        notes: notesRes.count || 0,
        sessions: sessionsRes.count || 0,
      });

    } catch (e: any) {
      console.error('Error loading details for user:', user.id, e);
      Alert.alert('Error', 'Failed to load details for user: ' + e.message);
    } finally {
      setLoadingUserDetails(false);
    }
  };

  const handleSaveSubscription = async () => {
    if (!selectedUser) return;
    setSavingSub(true);
    try {
      if (selectedPlanIdForUser === 'free') {
        // Delete active subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('user_id', selectedUser.id);
        
        if (error) throw error;
        Alert.alert('Success', 'User subscription deactivated (reset to Free tier)');
      } else {
        // Upsert subscription
        const subPayload: any = {
          user_id: selectedUser.id,
          plan_id: selectedPlanIdForUser,
          is_active: subIsActive,
          notes: subNotes,
          course_name: subCourseName, // Store selected course!
          updated_at: new Date().toISOString(),
        };

        if (subExpiresAt.trim()) {
          subPayload.expires_at = new Date(subExpiresAt).toISOString();
        } else {
          subPayload.expires_at = null; // Lifetime
        }

        if (userSub?.id) {
          subPayload.id = userSub.id;
        }

        const { error } = await supabase
          .from('user_subscriptions')
          .upsert(subPayload);

        if (error) throw error;
        Alert.alert('Success', 'User subscription updated successfully');
      }

      // Re-fetch user details
      selectUser(selectedUser);
      fetchStats();
      refreshPermissions();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save subscription: ' + e.message);
    } finally {
      setSavingSub(false);
    }
  };

  const toggleOverride = async (featureKey: string, currentOverride: boolean | null) => {
    if (!selectedUser) return;
    try {
      if (currentOverride === null) {
        // Step 1: Set Force Grant
        const { error } = await supabase
          .from('user_feature_overrides')
          .upsert({
            user_id: selectedUser.id,
            feature_key: featureKey,
            is_granted: true,
            reason: 'Admin override: Force Grant',
          }, { onConflict: 'user_id,feature_key' });
        if (error) throw error;
      } else if (currentOverride === true) {
        // Step 2: Set Force Revoke
        const { error } = await supabase
          .from('user_feature_overrides')
          .upsert({
            user_id: selectedUser.id,
            feature_key: featureKey,
            is_granted: false,
            reason: 'Admin override: Force Revoke',
          }, { onConflict: 'user_id,feature_key' });
        if (error) throw error;
      } else {
        // Step 3: Remove Override (Inherit)
        const { error } = await supabase
          .from('user_feature_overrides')
          .delete()
          .eq('user_id', selectedUser.id)
          .eq('feature_key', featureKey);
        if (error) throw error;
      }

      // Refresh overrides
      const { data: ovData } = await supabase
        .from('user_feature_overrides')
        .select('feature_key, is_granted, reason')
        .eq('user_id', selectedUser.id);
      setUserOverrides(ovData || []);
      refreshPermissions();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to toggle override: ' + e.message);
    }
  };

  const toggleCourseAccess = (course: string) => {
    let updatedAllowed: string[];
    if (userAllowedCourses.includes(course)) {
      updatedAllowed = userAllowedCourses.filter(c => c !== course);
    } else {
      updatedAllowed = [...userAllowedCourses, course];
    }
    setUserAllowedCourses(updatedAllowed);
    
    // Sync directly into the displayed JSON string in real-time!
    try {
      const parsed = JSON.parse(userPermissionsJson);
      parsed.allowedCourses = updatedAllowed;
      setUserPermissionsJson(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // If the JSON is currently being edited and is invalid, just create a new one
      setUserPermissionsJson(JSON.stringify({ allowedCourses: updatedAllowed }, null, 2));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    setSavingPermissions(true);
    try {
      // Validate JSON
      const parsedJson = JSON.parse(userPermissionsJson);
      
      // Merge allowedCourses
      const updatedPermissions = {
        ...parsedJson,
        allowedCourses: userAllowedCourses,
      };

      // Check if user settings record already exists
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', selectedUser.id)
        .maybeSingle();

      let error;
      if (existingSettings) {
        const res = await supabase
          .from('user_settings')
          .update({
            permissions: updatedPermissions,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', selectedUser.id);
        error = res.error;
      } else {
        const res = await supabase
          .from('user_settings')
          .insert({
            user_id: selectedUser.id,
            permissions: updatedPermissions,
            updated_at: new Date().toISOString(),
          });
        error = res.error;
      }

      if (error) throw error;
      setUserPermissionsJson(JSON.stringify(updatedPermissions, null, 2));
      Alert.alert('Success', 'User permissions and course access updated successfully');
      refreshPermissions();
    } catch (e: any) {
      Alert.alert('JSON Error', 'Invalid JSON syntax or DB update failed: ' + e.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: Platform.select({
          web: window.location.origin + '/reset-password',
          default: 'drupsc://reset-password',
        }),
      });

      if (error) throw error;
      Alert.alert('Success', 'Password reset email sent to ' + selectedUser.email);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send password reset: ' + e.message);
    }
  };

  // Quick Expiry Helper
  const setExpiryDays = (days: number) => {
    if (days === -1) {
      setSubExpiresAt(''); // Lifetime
    } else {
      const date = new Date();
      date.setDate(date.getDate() + days);
      setSubExpiresAt(date.toISOString().split('T')[0]);
    }
  };


  // --- TAB 2: FEATURES FUNCTIONS ---
  const fetchFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_features')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      setFeaturesList(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load features: ' + e.message);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const handleSaveFeature = async () => {
    if (!featForm.key.trim() || !featForm.name.trim()) {
      Alert.alert('Validation Error', 'Feature Key and Name are required.');
      return;
    }

    try {
      const payload = {
        key: featForm.key.trim().toLowerCase(),
        name: featForm.name.trim(),
        description: featForm.description.trim(),
        category: featForm.category,
        is_active: featForm.is_active,
        sort_order: Number(featForm.sort_order) || 0,
      };

      if (editingFeature) {
        // Edit existing feature
        const { error } = await supabase
          .from('access_features')
          .update(payload)
          .eq('id', editingFeature.id);
        if (error) throw error;
        Alert.alert('Success', 'Feature updated successfully');
      } else {
        // Create new feature
        const { error } = await supabase
          .from('access_features')
          .insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'Feature created successfully');
      }

      setFeatureModalVisible(false);
      setEditingFeature(null);
      fetchFeatures();
      fetchStats();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save feature: ' + e.message);
    }
  };

  const startEditFeature = (feat: any) => {
    setEditingFeature(feat);
    setFeatForm({
      key: feat.key,
      name: feat.name,
      description: feat.description || '',
      category: feat.category || 'feature',
      is_active: feat.is_active !== false,
      sort_order: feat.sort_order || 0,
    });
    setFeatureModalVisible(true);
  };

  const startAddFeature = () => {
    setEditingFeature(null);
    setFeatForm({
      key: '',
      name: '',
      description: '',
      category: 'feature',
      is_active: true,
      sort_order: featuresList.length > 0 ? Math.max(...featuresList.map(f => f.sort_order || 0)) + 10 : 10,
    });
    setFeatureModalVisible(true);
  };

  const handleDeleteFeature = async (feat: any) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to permanently delete the feature "${feat.name}"? This will cascade delete plan mappings!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('access_features')
                .delete()
                .eq('id', feat.id);
              if (error) throw error;
              Alert.alert('Success', 'Feature deleted successfully');
              fetchFeatures();
              fetchStats();
            } catch (e: any) {
              Alert.alert('Error', 'Failed to delete feature: ' + e.message);
            }
          },
        },
      ]
    );
  };

  // --- TAB 3: PLANS FUNCTIONS ---
  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_plans')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      setPlansList(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load plans: ' + e.message);
    } finally {
      setPlansLoading(false);
    }
  };

  const selectPlan = async (plan: any) => {
    setSelectedPlan(plan);
    try {
      // 1. Fetch Features Mapped to this plan
      const { data: planFeats } = await supabase
        .from('plan_features')
        .select('feature_id, is_granted')
        .eq('plan_id', plan.id);
      
      const mappedFeats: Record<string, boolean> = {};
      (planFeats || []).forEach(pf => {
        mappedFeats[pf.feature_id] = pf.is_granted;
      });
      setPlanFeatures(mappedFeats);

      // 2. Fetch Institutes
      const { data: planInsts } = await supabase
        .from('plan_institutes')
        .select('institute_name')
        .eq('plan_id', plan.id);
      setPlanInstitutes((planInsts || []).map(pi => pi.institute_name));

      // 3. Fetch Courses
      const { data: planCrs } = await supabase
        .from('plan_courses')
        .select('course_name')
        .eq('plan_id', plan.id);
      setPlanCourses((planCrs || []).map(pc => pc.course_name));

    } catch (e: any) {
      Alert.alert('Error', 'Failed to load plan mappings: ' + e.message);
    }
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      Alert.alert('Validation Error', 'Plan Name is required.');
      return;
    }

    try {
      const payload = {
        name: planForm.name.trim(),
        description: planForm.description.trim(),
        price: Number(planForm.price) || 0,
        currency: planForm.currency,
        interval: planForm.interval,
        is_active: planForm.is_active,
        sort_order: Number(planForm.sort_order) || 0,
      };

      if (editingPlan) {
        // Edit existing plan
        const { error } = await supabase
          .from('access_plans')
          .update(payload)
          .eq('id', editingPlan.id);
        if (error) throw error;
        Alert.alert('Success', 'Plan updated successfully');
      } else {
        // Create new plan
        const { error } = await supabase
          .from('access_plans')
          .insert(payload);
        if (error) throw error;
        Alert.alert('Success', 'Plan created successfully');
      }

      setPlanModalVisible(false);
      setEditingPlan(null);
      fetchPlans();
      fetchStats();
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save plan: ' + e.message);
    }
  };

  const startEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price || 0),
      currency: plan.currency || 'INR',
      interval: plan.interval || 'month',
      is_active: plan.is_active !== false,
      sort_order: plan.sort_order || 0,
    });
    setPlanModalVisible(true);
  };

  const startAddPlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      description: '',
      price: '0',
      currency: 'INR',
      interval: 'month',
      is_active: true,
      sort_order: plansList.length > 0 ? Math.max(...plansList.map(p => p.sort_order || 0)) + 10 : 10,
    });
    setPlanModalVisible(true);
  };

  const handleDeletePlan = async (plan: any) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to permanently delete plan "${plan.name}"? This will cancel subscriptions for this plan!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('access_plans')
                .delete()
                .eq('id', plan.id);
              if (error) throw error;
              Alert.alert('Success', 'Plan deleted successfully');
              setSelectedPlan(null);
              fetchPlans();
              fetchStats();
            } catch (e: any) {
              Alert.alert('Error', 'Failed to delete plan: ' + e.message);
            }
          },
        },
      ]
    );
  };

  // Plan-Feature checkbox toggler
  const togglePlanFeature = async (featureId: string) => {
    if (!selectedPlan) return;
    const isCurrentlyGranted = planFeatures[featureId] === true;
    try {
      if (isCurrentlyGranted) {
        // Delete mapping
        const { error } = await supabase
          .from('plan_features')
          .delete()
          .eq('plan_id', selectedPlan.id)
          .eq('feature_id', featureId);
        if (error) throw error;
      } else {
        // Insert mapping
        const { error } = await supabase
          .from('plan_features')
          .insert({
            plan_id: selectedPlan.id,
            feature_id: featureId,
            is_granted: true,
          });
        if (error) throw error;
      }

      // Re-fetch mappings
      setPlanFeatures(prev => ({
        ...prev,
        [featureId]: !isCurrentlyGranted,
      }));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to modify plan feature: ' + e.message);
    }
  };

  // Plan-Institute tag add/remove
  const handleAddInstituteDirectly = async (instName: string) => {
    if (!selectedPlan || !instName) return;
    const cleanName = instName.trim();
    if (planInstitutes.includes(cleanName)) {
      Alert.alert('Info', 'Institute already mapped.');
      return;
    }

    try {
      const { error } = await supabase
        .from('plan_institutes')
        .insert({
          plan_id: selectedPlan.id,
          institute_name: cleanName,
        });

      if (error) throw error;
      setPlanInstitutes(prev => [...prev, cleanName]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to add institute: ' + e.message);
    }
  };

  const handleRemoveInstitute = async (instName: string) => {
    if (!selectedPlan) return;
    try {
      const { error } = await supabase
        .from('plan_institutes')
        .delete()
        .eq('plan_id', selectedPlan.id)
        .eq('institute_name', instName);

      if (error) throw error;
      setPlanInstitutes(prev => prev.filter(i => i !== instName));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to remove institute: ' + e.message);
    }
  };

  // Plan-Course tag add/remove
  const handleAddCourseDirectly = async (courseName: string) => {
    if (!selectedPlan || !courseName) return;
    const cleanName = courseName.trim();
    if (planCourses.includes(cleanName)) {
      Alert.alert('Info', 'Course already mapped.');
      return;
    }

    try {
      const { error } = await supabase
        .from('plan_courses')
        .insert({
          plan_id: selectedPlan.id,
          course_name: cleanName,
        });

      if (error) throw error;
      setPlanCourses(prev => [...prev, cleanName]);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to add course: ' + e.message);
    }
  };

  const handleRemoveCourse = async (courseName: string) => {
    if (!selectedPlan) return;
    try {
      const { error } = await supabase
        .from('plan_courses')
        .delete()
        .eq('plan_id', selectedPlan.id)
        .eq('course_name', courseName);

      if (error) throw error;
      setPlanCourses(prev => prev.filter(c => c !== courseName));
    } catch (e: any) {
      Alert.alert('Error', 'Failed to remove course: ' + e.message);
    }
  };


  // --- TAB 4: GLOBAL CONFIG FUNCTIONS ---
  const fetchGlobalConfig = async () => {
    // Check local storage or mock query from special user settings
    // Here we check if the admin wants to simulate a global config
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('permissions')
        .eq('user_id', '00000000-0000-0000-0000-000000000000') // Reserved System Config ID
        .maybeSingle();

      if (data?.permissions) {
        const conf = data.permissions as any;
        setPaywallBypassActive(conf.paywallBypass === true);
        setAnnouncementBannerText(conf.bannerText || '');
        setAnnouncementBannerType(conf.bannerType || 'info');
        setAnnouncementBannerActive(conf.bannerActive === true);
      }
    } catch (e) {
      console.log('No system user settings found, using default state.', e);
    }
  };

  const handleSaveGlobalConfig = async () => {
    setSavingGlobalConfig(true);
    try {
      // Upsert into reserved system user row in user_settings table
      const confPayload = {
        paywallBypass: paywallBypassActive,
        bannerText: announcementBannerText,
        bannerType: announcementBannerType,
        bannerActive: announcementBannerActive,
        updatedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: '00000000-0000-0000-0000-000000000000',
          permissions: confPayload,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      Alert.alert('Success', 'Global system configurations saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save configuration: ' + e.message);
    } finally {
      setSavingGlobalConfig(false);
    }
  };


  // --- UI RENDER DETAILS ---

  if (checkingAuth) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textSecondary, fontWeight: '700' }}>Verifying Permissions...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <PageWrapper>
        <View style={[styles.unauthContainer, { backgroundColor: colors.bg }]}>
          <View style={[styles.lockCircle, { backgroundColor: colors.surface }]}>
            <Lock size={64} color="#ef4444" />
          </View>
          <Text style={[styles.unauthTitle, { color: colors.textPrimary }]}>Access Denied</Text>
          <Text style={[styles.unauthDesc, { color: colors.textTertiary }]}>
            This screen is restricted to administrators only. Your email ({userEmail}) is not authorized.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color="#fff" />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        {/* Header Block */}
        <View style={[styles.headerBlock, { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
              <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={20} color="#ef4444" />
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Admin Console</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>{userEmail}</Text>
            </View>
            <TouchableOpacity onPress={() => loadTabContent(activeTab)} style={styles.iconButton}>
              <RefreshCw size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.usersCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Users</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.plansCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Plans</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.featuresCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Features</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.subsCount}</Text>
              <Text style={{ fontSize: 9, color: colors.textTertiary }}>Active Subs</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {[
            { key: 'users', label: 'Users', icon: Users },
            { key: 'features', label: 'Features', icon: Key },
            { key: 'plans', label: 'Plans', icon: CreditCard },
            { key: 'config', label: 'Global Config', icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  setActiveTab(t.key as TabType);
                  setSelectedUser(null);
                  setSelectedPlan(null);
                }}
                style={[
                  styles.tabButton,
                  active && { borderBottomColor: colors.primary },
                ]}
              >
                <Icon size={16} color={active ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textTertiary }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          
          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <View style={styles.tabContent}>
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  placeholder="Search user by email..."
                  placeholderTextColor={colors.textTertiary}
                  value={userSearch}
                  onChangeText={(val) => {
                    setUserSearch(val);
                    fetchUsers(val);
                  }}
                  style={{ flex: 1, color: colors.textPrimary, paddingLeft: 8, fontSize: 14 }}
                />
                {userSearch.trim().length > 0 && (
                  <TouchableOpacity onPress={() => { setUserSearch(''); fetchUsers(''); }}>
                    <X size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {usersLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />}

              {!selectedUser ? (
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>MATCHING USERS</Text>
                  {usersList.length === 0 && !usersLoading && (
                    <Text style={{ fontStyle: 'italic', color: colors.textTertiary, textAlign: 'center', marginTop: 12 }}>
                      No matching users found.
                    </Text>
                  )}
                  {usersList.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => selectUser(u)}
                      style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{u.email}</Text>
                        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>ID: {u.id}</Text>
                      </View>
                      <ChevronRight size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View>
                  {/* Selected User Header */}
                  <TouchableOpacity
                    onPress={() => setSelectedUser(null)}
                    style={[styles.backToUserList, { backgroundColor: colors.surface }]}
                  >
                    <ArrowLeft size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Back to User List</Text>
                  </TouchableOpacity>

                  <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>USER PROFILE</Text>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>{selectedUser.email}</Text>
                    <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>ID: {selectedUser.id}</Text>
                    {selectedUser.created_at && (
                      <Text style={{ fontSize: 10, color: colors.textTertiary }}>Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</Text>
                    )}

                    {/* Stats grid */}
                    <View style={styles.statsGrid}>
                      <View style={[styles.gridCell, { backgroundColor: colors.surfaceStrong }]}>
                        <Sparkles size={16} color={colors.primary} />
                        <Text style={[styles.gridCellNum, { color: colors.textPrimary }]}>{userStats.reviews}</Text>
                        <Text style={{ fontSize: 8, color: colors.textTertiary }}>Reviews</Text>
                      </View>
                      <View style={[styles.gridCell, { backgroundColor: colors.surfaceStrong }]}>
                        <Activity size={16} color={colors.primary} />
                        <Text style={[styles.gridCellNum, { color: colors.textPrimary }]}>{userStats.attempts}</Text>
                        <Text style={{ fontSize: 8, color: colors.textTertiary }}>Attempts</Text>
                      </View>
                      <View style={[styles.gridCell, { backgroundColor: colors.surfaceStrong }]}>
                        <FileText size={16} color={colors.primary} />
                        <Text style={[styles.gridCellNum, { color: colors.textPrimary }]}>{userStats.notes}</Text>
                        <Text style={{ fontSize: 8, color: colors.textTertiary }}>Notebooks</Text>
                      </View>
                      <View style={[styles.gridCell, { backgroundColor: colors.surfaceStrong }]}>
                        <Calendar size={16} color={colors.primary} />
                        <Text style={[styles.gridCellNum, { color: colors.textPrimary }]}>{userStats.sessions}</Text>
                        <Text style={{ fontSize: 8, color: colors.textTertiary }}>Sessions</Text>
                      </View>
                    </View>
                  </View>

                  {loadingUserDetails ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                  ) : (
                    <>
                      {/* Subscription editor */}
                      <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>SUBSCRIPTION CONTROL</Text>
                        
                        <Text style={styles.formLabel}>Active Plan</Text>
                        <View style={styles.planPickers}>
                          <TouchableOpacity
                            onPress={() => setSelectedPlanIdForUser('free')}
                            style={[
                              styles.planChip,
                              { backgroundColor: selectedPlanIdForUser === 'free' ? colors.primary : colors.surfaceStrong }
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: selectedPlanIdForUser === 'free' ? '#fff' : colors.textPrimary }}>FREE</Text>
                          </TouchableOpacity>
                          {plansList.map(plan => (
                            <TouchableOpacity
                              key={plan.id}
                              onPress={() => setSelectedPlanIdForUser(plan.id)}
                              style={[
                                styles.planChip,
                                { backgroundColor: selectedPlanIdForUser === plan.id ? colors.primary : colors.surfaceStrong }
                              ]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: selectedPlanIdForUser === plan.id ? '#fff' : colors.textPrimary }}>
                                {plan.name.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {selectedPlanIdForUser !== 'free' && (
                          <View style={{ marginTop: 16 }}>
                            {/* Course selection for subscription (Issue 6) */}
                            <Text style={styles.formLabel}>Purchase Course Mappings</Text>
                            <TouchableOpacity
                              onPress={() => setCoursePickerVisible(true)}
                              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 12 }]}
                            >
                              <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{subCourseName || 'Civil Services'}</Text>
                              <ChevronRight size={16} color={colors.textTertiary} />
                            </TouchableOpacity>

                            <View style={styles.switchRow}>
                              <Text style={styles.formLabel}>Subscription Status</Text>
                              <Switch
                                value={subIsActive}
                                onValueChange={setSubIsActive}
                                trackColor={{ false: '#4b5563', true: '#22c55e' }}
                              />
                            </View>

                            <Text style={[styles.formLabel, { marginTop: 12 }]}>Expiration Date (YYYY-MM-DD)</Text>
                            <TextInput
                              placeholder="e.g. 2026-12-31 (leave blank for Lifetime)"
                              placeholderTextColor={colors.textTertiary}
                              value={subExpiresAt}
                              onChangeText={setSubExpiresAt}
                              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                            />

                            {/* Quick presets */}
                            <View style={styles.presetsRow}>
                              <TouchableOpacity onPress={() => setExpiryDays(30)} style={[styles.presetBtn, { backgroundColor: colors.surfaceStrong }]}><Text style={{ fontSize: 9, color: colors.textSecondary }}>+30 Days</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => setExpiryDays(90)} style={[styles.presetBtn, { backgroundColor: colors.surfaceStrong }]}><Text style={{ fontSize: 9, color: colors.textSecondary }}>+90 Days</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => setExpiryDays(365)} style={[styles.presetBtn, { backgroundColor: colors.surfaceStrong }]}><Text style={{ fontSize: 9, color: colors.textSecondary }}>+1 Year</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => setExpiryDays(-1)} style={[styles.presetBtn, { backgroundColor: colors.surfaceStrong }]}><Text style={{ fontSize: 9, color: colors.textSecondary }}>Lifetime</Text></TouchableOpacity>
                            </View>

                            <Text style={[styles.formLabel, { marginTop: 12 }]}>Notes</Text>
                            <TextInput
                              placeholder="Reason/reference for this plan..."
                              placeholderTextColor={colors.textTertiary}
                              value={subNotes}
                              onChangeText={setSubNotes}
                              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                            />
                          </View>
                        )}

                        <TouchableOpacity
                          disabled={savingSub}
                          onPress={handleSaveSubscription}
                          style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
                        >
                          {savingSub ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Subscription</Text>}
                        </TouchableOpacity>
                      </View>

                      {/* Course overrides (Issue 5) */}
                      <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>USER-SPECIFIC COURSE ACCESS</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 12 }}>
                          Choose exactly which courses this user is allowed to access. Unchecking all defaults to plan mappings.
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                          {availableCourses.map(course => {
                            const hasAccess = userAllowedCourses.includes(course);
                            return (
                              <TouchableOpacity
                                key={course}
                                onPress={() => toggleCourseAccess(course)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 10,
                                  borderWidth: 1.5,
                                  borderColor: hasAccess ? colors.primary : colors.border,
                                  backgroundColor: hasAccess ? colors.primary + '12' : colors.surfaceStrong,
                                }}
                              >
                                <View style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  borderWidth: 1,
                                  borderColor: hasAccess ? colors.primary : colors.textTertiary,
                                  backgroundColor: hasAccess ? colors.primary : 'transparent',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  {hasAccess && <Check size={10} color="#fff" />}
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>{course}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Feature overrides */}
                      <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>FEATURE OVERRIDES</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 12 }}>
                          Overrides bypass subscription rules. Tap a feature to toggle: Inherit → Force Grant → Force Revoke.
                        </Text>

                        {featuresList.map(feat => {
                          const override = userOverrides.find(o => o.feature_key === feat.key);
                          const state = override ? override.is_granted : null; // true / false / null (inherit)

                          let badgeColor = colors.border;
                          let badgeText = 'Plan Default';
                          let badgeTextColor = colors.textTertiary;
                          if (state === true) {
                            badgeColor = '#22c55e' + '20';
                            badgeText = 'Force Grant';
                            badgeTextColor = '#22c55e';
                          } else if (state === false) {
                            badgeColor = '#ef4444' + '20';
                            badgeText = 'Force Revoke';
                            badgeTextColor = '#ef4444';
                          }

                          return (
                            <TouchableOpacity
                              key={feat.id}
                              onPress={() => toggleOverride(feat.key, state)}
                              style={[styles.overrideRow, { borderBottomColor: colors.border }]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{feat.name}</Text>
                                <Text style={{ fontSize: 9, color: colors.textTertiary }}>{feat.key}</Text>
                              </View>
                              <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: badgeTextColor }}>{badgeText}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* JSON settings permissions */}
                      <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>USER SETTINGS PERMISSIONS</Text>
                        <TextInput
                          multiline
                          placeholder="JSON permissions object..."
                          value={userPermissionsJson}
                          onChangeText={setUserPermissionsJson}
                          style={[styles.jsonInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                        />
                        <TouchableOpacity
                          disabled={savingPermissions}
                          onPress={handleSavePermissions}
                          style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                        >
                          {savingPermissions ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Permissions JSON</Text>}
                        </TouchableOpacity>
                      </View>

                      {/* Support tools */}
                      <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>USER SUPPORT ACTIONS</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity
                            onPress={handlePasswordReset}
                            style={[styles.actionBtn, { borderColor: colors.primary, flex: 1 }]}
                          >
                            <UserCheck size={16} color={colors.primary} />
                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Password Reset</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>ALL ACCESS FEATURES</Text>
                <TouchableOpacity
                  onPress={startAddFeature}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add Feature</Text>
                </TouchableOpacity>
              </View>

              {featuresLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />}

              {featuresList.map((f) => (
                <View
                  key={f.id}
                  style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{f.name}</Text>
                      <View style={[styles.badge, { backgroundColor: f.is_active !== false ? '#22c55e20' : '#ef444420' }]}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: f.is_active !== false ? '#22c55e' : '#ef4444' }}>
                          {f.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>Key: {f.key} • Category: {f.category || 'feature'}</Text>
                    {f.description && <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>{f.description}</Text>}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginLeft: 12 }}>
                    <TouchableOpacity onPress={() => startEditFeature(f)} style={[styles.iconActionBtn, { backgroundColor: colors.surfaceStrong }]}>
                      <Edit2 size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteFeature(f)} style={[styles.iconActionBtn, { backgroundColor: '#ef444415' }]}>
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* TAB 3: PLANS */}
          {activeTab === 'plans' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>SUBSCRIPTION PLANS</Text>
                <TouchableOpacity
                  onPress={startAddPlan}
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addBtnText}>Add Plan</Text>
                </TouchableOpacity>
              </View>

              {plansLoading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />}

              {/* Plans list */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {plansList.map((p) => {
                  const isSel = selectedPlan?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => selectPlan(p)}
                      style={[
                        styles.planCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: isSel ? colors.primary : colors.border,
                          borderWidth: isSel ? 2 : 1,
                        }
                      ]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{p.name}</Text>
                        <View style={[styles.badge, { backgroundColor: p.is_active !== false ? '#22c55e20' : '#ef444420' }]}>
                          <Text style={{ fontSize: 8, fontWeight: '800', color: p.is_active !== false ? '#22c55e' : '#ef4444' }}>
                            {p.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.primary, marginTop: 8 }}>
                        ₹{p.price} <Text style={{ fontSize: 10, color: colors.textTertiary }}>/{p.interval}</Text>
                      </Text>
                      {p.description && <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, height: 32 }} numberOfLines={2}>{p.description}</Text>}
                      
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                        <TouchableOpacity onPress={() => startEditPlan(p)} style={[styles.planCardAction, { backgroundColor: colors.surfaceStrong }]}>
                          <Edit2 size={12} color={colors.textSecondary} />
                          <Text style={{ fontSize: 9, color: colors.textSecondary, marginLeft: 4 }}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePlan(p)} style={[styles.planCardAction, { backgroundColor: '#ef444410' }]}>
                          <Trash2 size={12} color="#ef4444" />
                          <Text style={{ fontSize: 9, color: "#ef4444", marginLeft: 4 }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Plan mapping editor */}
              {selectedPlan && (
                <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 4 }]}>PLAN MAPPING DETAILS</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 }}>{selectedPlan.name}</Text>

                  {/* Feature Checkboxes */}
                  <Text style={[styles.formLabel, { marginBottom: 8 }]}>Granted Features</Text>
                  {featuresList.map(feat => {
                    const isGranted = planFeatures[feat.id] === true;
                    return (
                      <TouchableOpacity
                        key={feat.id}
                        onPress={() => togglePlanFeature(feat.id)}
                        style={styles.checkboxRow}
                      >
                        <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: isGranted ? colors.primary : 'transparent' }]}>
                          {isGranted && <Check size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{feat.name}</Text>
                          <Text style={{ fontSize: 9, color: colors.textTertiary }}>{feat.key}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />

                  {/* Institute Access */}
                  <Text style={styles.formLabel}>Coaching Institute Access</Text>
                  <TouchableOpacity
                    onPress={() => setInstPickerVisible(true)}
                    style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 12 }]}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Select Institute...</Text>
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.tagsContainer}>
                    {planInstitutes.length === 0 && <Text style={{ fontStyle: 'italic', color: colors.textTertiary, fontSize: 11 }}>All institutes granted (unrestricted)</Text>}
                    {planInstitutes.map(inst => (
                      <View key={inst} style={[styles.tag, { backgroundColor: colors.surfaceStrong }]}>
                        <Text style={{ fontSize: 11, color: colors.textPrimary }}>{inst}</Text>
                        <TouchableOpacity onPress={() => handleRemoveInstitute(inst)} style={{ marginLeft: 6 }}>
                          <X size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />

                  {/* Course Access */}
                  <Text style={styles.formLabel}>Course Access</Text>
                  <TouchableOpacity
                    onPress={() => setPlanCoursePickerVisible(true)}
                    style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 12 }]}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Select Course...</Text>
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.tagsContainer}>
                    {planCourses.length === 0 && <Text style={{ fontStyle: 'italic', color: colors.textTertiary, fontSize: 11 }}>All courses granted (unrestricted)</Text>}
                    {planCourses.map(course => (
                      <View key={course} style={[styles.tag, { backgroundColor: colors.surfaceStrong }]}>
                        <Text style={{ fontSize: 11, color: colors.textPrimary }}>{course}</Text>
                        <TouchableOpacity onPress={() => handleRemoveCourse(course)} style={{ marginLeft: 6 }}>
                          <X size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* TAB 4: GLOBAL CONFIG */}
          {activeTab === 'config' && (
            <View style={styles.tabContent}>
              <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>GLOBAL ANNOUNCEMENTS & CONTROLS</Text>
              
              <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Global Paywall Bypass</Text>
                    <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>Unlock all access tiers dynamically for debugging.</Text>
                  </View>
                  <Switch
                    value={paywallBypassActive}
                    onValueChange={setPaywallBypassActive}
                    trackColor={{ false: '#4b5563', true: '#22c55e' }}
                  />
                </View>
              </View>

              <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.sectionSub, { color: colors.textTertiary, marginBottom: 12 }]}>SYSTEM NOTIFICATION BANNER</Text>
                
                <View style={[styles.switchRow, { marginBottom: 12 }]}>
                  <Text style={styles.formLabel}>Show Banner in App</Text>
                  <Switch
                    value={announcementBannerActive}
                    onValueChange={setAnnouncementBannerActive}
                    trackColor={{ false: '#4b5563', true: '#22c55e' }}
                  />
                </View>

                <Text style={styles.formLabel}>Banner Message</Text>
                <TextInput
                  placeholder="Announce details to users..."
                  placeholderTextColor={colors.textTertiary}
                  value={announcementBannerText}
                  onChangeText={setAnnouncementBannerText}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />

                <Text style={styles.formLabel}>Banner Style</Text>
                <View style={styles.planPickers}>
                  {['info', 'warning', 'success'].map(type => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setAnnouncementBannerType(type)}
                      style={[
                        styles.planChip,
                        { backgroundColor: announcementBannerType === type ? colors.primary : colors.surfaceStrong }
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: announcementBannerType === type ? '#fff' : colors.textPrimary }}>
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  disabled={savingGlobalConfig}
                  onPress={handleSaveGlobalConfig}
                  style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                >
                  {savingGlobalConfig ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Configurations</Text>}
                </TouchableOpacity>
              </View>

              {/* Dev notice */}
              <View style={[styles.detailBlock, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.primary }]}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Database size={16} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textPrimary }}>Hardcoded Bypass Lists</Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, lineHeight: 16 }}>
                  Bypass lists are managed in:
                  {"\n"}- [AccessControlContext.tsx](file:///c:/Users/Dr.%20Yogesh/Videos/APP%20FOLDER%20-%20V1%20-%20Copy/app/frontend-noji-2.6.2/3/pilot%20pro%2010.2/src/context/AccessControlContext.tsx)
                  {"\n"}- [ai-settings.tsx](file:///c:/Users/Dr.%20Yogesh/Videos/APP%20FOLDER%20-%20V1%20-%20Copy/app/frontend-noji-2.6.2/3/pilot%20pro%2010.2/app/ai-settings.tsx)
                  {"\n"}Ensure those files are aligned for global administration.
                </Text>
              </View>
            </View>
          )}

        </ScrollView>

        {/* --- MODAL: CREATE / EDIT FEATURE --- */}
        <Modal
          visible={featureModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setFeatureModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                  {editingFeature ? 'Edit Feature' : 'Create Feature'}
                </Text>
                <TouchableOpacity onPress={() => setFeatureModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.formLabel}>Feature Key (Unique, e.g. export_pdf)</Text>
                <TextInput
                  placeholder="e.g. export_pdf"
                  placeholderTextColor={colors.textTertiary}
                  editable={!editingFeature}
                  value={featForm.key}
                  onChangeText={(val) => setFeatForm(prev => ({ ...prev, key: val }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, opacity: editingFeature ? 0.6 : 1 }]}
                />

                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  placeholder="e.g. Export Notes to PDF"
                  placeholderTextColor={colors.textTertiary}
                  value={featForm.name}
                  onChangeText={(val) => setFeatForm(prev => ({ ...prev, name: val }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  placeholder="Brief summary of feature capability..."
                  placeholderTextColor={colors.textTertiary}
                  value={featForm.description}
                  onChangeText={(val) => setFeatForm(prev => ({ ...prev, description: val }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />

                <Text style={styles.formLabel}>Category</Text>
                <View style={styles.planPickers}>
                  {['feature', 'institute', 'course', 'test'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setFeatForm(prev => ({ ...prev, category: cat }))}
                      style={[
                        styles.planChip,
                        { backgroundColor: featForm.category === cat ? colors.primary : colors.surfaceStrong }
                      ]}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '700', color: featForm.category === cat ? '#fff' : colors.textPrimary }}>
                        {cat.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.switchRow, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Active / Enabled</Text>
                  <Switch
                    value={featForm.is_active}
                    onValueChange={(val) => setFeatForm(prev => ({ ...prev, is_active: val }))}
                    trackColor={{ false: '#4b5563', true: '#22c55e' }}
                  />
                </View>

                <Text style={[styles.formLabel, { marginTop: 12 }]}>Sort Order (Number)</Text>
                <TextInput
                  placeholder="e.g. 10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={String(featForm.sort_order)}
                  onChangeText={(val) => setFeatForm(prev => ({ ...prev, sort_order: Number(val) || 0 }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />
              </ScrollView>

              <TouchableOpacity
                onPress={handleSaveFeature}
                style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              >
                <Text style={styles.saveBtnText}>Save Feature</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: CREATE / EDIT PLAN --- */}
        <Modal
          visible={planModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPlanModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>
                  {editingPlan ? 'Edit Plan' : 'Create Plan'}
                </Text>
                <TouchableOpacity onPress={() => setPlanModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.formLabel}>Plan Name</Text>
                <TextInput
                  placeholder="e.g. Pro Monthly"
                  placeholderTextColor={colors.textTertiary}
                  value={planForm.name}
                  onChangeText={(val) => setPlanForm(prev => ({ ...prev, name: val }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  placeholder="What is included in this tier..."
                  placeholderTextColor={colors.textTertiary}
                  value={planForm.description}
                  onChangeText={(val) => setPlanForm(prev => ({ ...prev, description: val }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Price (Amount)</Text>
                    <TextInput
                      placeholder="e.g. 499"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      value={planForm.price}
                      onChangeText={(val) => setPlanForm(prev => ({ ...prev, price: val }))}
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Currency</Text>
                    <TextInput
                      placeholder="INR"
                      placeholderTextColor={colors.textTertiary}
                      value={planForm.currency}
                      onChangeText={(val) => setPlanForm(prev => ({ ...prev, currency: val }))}
                      style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                    />
                  </View>
                </View>

                <Text style={styles.formLabel}>Interval</Text>
                <View style={styles.planPickers}>
                  {['month', 'year', 'lifetime', 'one_time'].map(int => (
                    <TouchableOpacity
                      key={int}
                      onPress={() => setPlanForm(prev => ({ ...prev, interval: int }))}
                      style={[
                        styles.planChip,
                        { backgroundColor: planForm.interval === int ? colors.primary : colors.surfaceStrong }
                      ]}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '700', color: planForm.interval === int ? '#fff' : colors.textPrimary }}>
                        {int.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={[styles.switchRow, { marginTop: 16 }]}>
                  <Text style={styles.formLabel}>Plan Active / Available</Text>
                  <Switch
                    value={planForm.is_active}
                    onValueChange={(val) => setPlanForm(prev => ({ ...prev, is_active: val }))}
                    trackColor={{ false: '#4b5563', true: '#22c55e' }}
                  />
                </View>

                <Text style={[styles.formLabel, { marginTop: 12 }]}>Sort Order (Number)</Text>
                <TextInput
                  placeholder="e.g. 10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  value={String(planForm.sort_order)}
                  onChangeText={(val) => setPlanForm(prev => ({ ...prev, sort_order: Number(val) || 0 }))}
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                />
              </ScrollView>

              <TouchableOpacity
                onPress={handleSavePlan}
                style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
              >
                <Text style={styles.saveBtnText}>Save Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 1. Coaching Institute Picker Modal (Issue 3) */}
        <Modal
          visible={instPickerVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setInstPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Select Coaching Institute</Text>
                <TouchableOpacity onPress={() => setInstPickerVisible(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Custom Input inside Picker */}
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: 10 }}>
                <TextInput
                  placeholder="Or type custom institute..."
                  placeholderTextColor={colors.textTertiary}
                  value={newInstName}
                  onChangeText={setNewInstName}
                  style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.border, marginBottom: 0, paddingVertical: 6 }]}
                />
                <TouchableOpacity 
                  onPress={() => {
                    if (newInstName.trim()) {
                      handleAddInstituteDirectly(newInstName.trim());
                      setNewInstName('');
                      setInstPickerVisible(false);
                    }
                  }}
                  style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 250 }}>
                {availableInstitutes
                  .filter(inst => !planInstitutes.includes(inst))
                  .map(inst => (
                    <TouchableOpacity
                      key={inst}
                      onPress={() => {
                        handleAddInstituteDirectly(inst);
                        setInstPickerVisible(false);
                      }}
                      style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{inst}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 2. Plan Course Picker Modal (Issue 3) */}
        <Modal
          visible={planCoursePickerVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setPlanCoursePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Select Course Access</Text>
                <TouchableOpacity onPress={() => setPlanCoursePickerVisible(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Custom Input inside Picker */}
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: 10 }}>
                <TextInput
                  placeholder="Or type custom course..."
                  placeholderTextColor={colors.textTertiary}
                  value={newCourseName}
                  onChangeText={setNewCourseName}
                  style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.border, marginBottom: 0, paddingVertical: 6 }]}
                />
                <TouchableOpacity 
                  onPress={() => {
                    if (newCourseName.trim()) {
                      handleAddCourseDirectly(newCourseName.trim());
                      setNewCourseName('');
                      setPlanCoursePickerVisible(false);
                    }
                  }}
                  style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 250 }}>
                {availableCourses
                  .filter(c => !planCourses.includes(c))
                  .map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => {
                        handleAddCourseDirectly(c);
                        setPlanCoursePickerVisible(false);
                      }}
                      style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                    >
                      <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 3. Subscription Course Picker Modal (Issue 6) */}
        <Modal
          visible={coursePickerVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setCoursePickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Select Subscription Course</Text>
                <TouchableOpacity onPress={() => setCoursePickerVisible(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {availableCourses.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => {
                      setSubCourseName(c);
                      setCoursePickerVisible(false);
                    }}
                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#ef4444' + '40' },
  unauthTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  unauthDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  headerBlock: { padding: 16, borderBottomWidth: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  iconButton: { padding: 6, borderRadius: 8 },
  
  statsBar: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '900' },
  statDivider: { width: 1, height: 24 },
  
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', gap: 4 },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  
  tabContent: { padding: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 10, letterSpacing: 1, fontWeight: '800', marginBottom: 10 },
  sectionSub: { fontSize: 9, letterSpacing: 1, fontWeight: '800' },
  
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  backToUserList: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  
  detailBlock: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  gridCell: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 10 },
  gridCellNum: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  
  formLabel: { fontSize: 11, fontWeight: '800', color: '#888', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 12, marginBottom: 12 },
  jsonInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 11, minHeight: 120, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  
  planPickers: { flexDirection: 'row', gap: 6 },
  planChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetsRow: { flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 12 },
  presetBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  
  overrideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  
  actionBtn: { borderWidth: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  
  tabHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  
  featureCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  iconActionBtn: { padding: 8, borderRadius: 8 },
  
  planCard: { width: 160, borderWidth: 1, borderRadius: 12, padding: 12, marginRight: 8 },
  planCardAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: 6 },
  
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tagInputRow: { flexDirection: 'row', gap: 8 },
  addTagBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 18, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
});
