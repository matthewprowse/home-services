import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar"
import { Plus, PanelLeft, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function AppSidebar() {
  const { toggleSidebar } = useSidebar()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentId = searchParams.get("id")
  
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setConversations([])
      return
    }

    const fetchConversations = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setConversations(data)
      }
      setIsLoading(false)
    }

    fetchConversations()
  }, [user])

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center px-4">
        <div className="flex items-center justify-between w-full gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            onClick={() => router.push("/")}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={toggleSidebar}
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-4 py-2 text-xs text-muted-foreground animate-pulse">
                  Loading chats...
                </div>
              ) : conversations.length > 0 ? (
                conversations.map((conv) => (
                  <SidebarMenuItem key={conv.id}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={currentId === conv.id}
                      className="h-9"
                    >
                      <a href={`/chat?id=${conv.id}`}>
                        <span className="truncate">{conv.title || "New Diagnosis"}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="px-4 py-2 text-xs text-muted-foreground">
                  {user ? "No recent chats" : "Sign in to see history"}
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" className="h-9">
              <a href="/settings">
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
