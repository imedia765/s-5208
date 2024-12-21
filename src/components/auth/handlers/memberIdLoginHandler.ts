import { supabase } from "@/integrations/supabase/client";
import { ToastType } from "@/hooks/use-toast";

export const handleMemberIdLogin = async (
  memberId: string,
  password: string,
  { toast }: ToastType
) => {
  try {
    console.log("Attempting member ID login for:", memberId);

    // First get the member's data using member number
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('member_number', memberId)
      .maybeSingle();

    if (memberError) {
      console.error("Member lookup error:", memberError);
      throw new Error("Error looking up member");
    }

    if (!memberData) {
      console.error("No member found with ID:", memberId);
      throw new Error("Member not found. Please check your Member ID.");
    }

    if (!memberData.email) {
      console.error("Member has no email:", memberId);
      throw new Error("Member account not properly configured. Please contact support.");
    }

    // Sign in with email and password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: memberData.email,
      password: password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
      if (signInError.message.includes("Invalid login credentials")) {
        throw new Error("Invalid password. For first-time login, use your Member ID as the password.");
      }
      throw signInError;
    }

    if (!signInData.user) {
      throw new Error("No user data returned after login");
    }

    console.log("User signed in successfully:", signInData.user.id);

    // Check if profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signInData.user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Error checking profile:", profileError);
      throw profileError;
    }

    // If no profile exists, create one with member data
    if (!existingProfile) {
      console.log("Creating new profile for user:", signInData.user.id);
      
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: signInData.user.id,
          email: memberData.email,
          user_id: signInData.user.id,
          full_name: memberData.full_name,
          member_number: memberData.member_number,
          date_of_birth: memberData.date_of_birth,
          gender: memberData.gender,
          marital_status: memberData.marital_status,
          phone: memberData.phone,
          address: memberData.address,
          postcode: memberData.postcode,
          town: memberData.town,
          profile_completed: memberData.profile_completed
        });

      if (createError) {
        console.error("Error creating profile:", createError);
        throw createError;
      }
    }

    return true;
  } catch (error) {
    console.error("Login process error:", error);
    toast({
      title: "Login failed",
      description: error instanceof Error ? error.message : "An error occurred during login",
      variant: "destructive",
    });
    return false;
  }
};