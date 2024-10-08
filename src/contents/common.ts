import './polyfill'

import { Links, MessageFrom, MessageKey, StorageKey } from '../constants'
import { iconGitHub, iconLogo } from '../icons'
import type { MessageData, Options, ThemeType } from '../types'
import {
  deepMerge,
  getRunEnv,
  getStorage,
  getV2P_Settings,
  injectScript,
  setStorage,
} from '../utils'
import { $body, $infoCard, $wrapper } from './globals'
import { loadIcons, postTask, setTheme } from './helpers'

if ($('#site-header').length > 0) {
  $body.addClass('v2p-mobile')
}

/** 切换主题。 */
const toggleTheme = ({
  $toggle,
  prefersDark,
  themeType = 'light-default',
}: {
  $toggle: JQuery
  prefersDark: boolean
  themeType?: ThemeType
}) => {
  const wrapperDark = $wrapper.hasClass('Night')
  const shouldSync = (prefersDark && !wrapperDark) || (!prefersDark && wrapperDark)

  // 如果检测到本地设置与用户偏好设置不一致：
  if (shouldSync) {
    const toggleThemeUrl = $toggle.attr('href') // href='/settings/night/toggle'

    // 调用远程接口修改 cookie，以便下次刷新页面时保持配置一致。
    if (typeof toggleThemeUrl === 'string') {
      fetch(toggleThemeUrl)
    }

    // 同时修改切换按钮。
    if (prefersDark) {
      $toggle.prop('title', '使用浅色主题')
      $toggle.html('<i data-lucide="sun"></i>')
    } else {
      $toggle.prop('title', '使用深色主题')
      $toggle.html('<i data-lucide="moon"></i>')
    }
  }

  if (prefersDark) {
    setTheme('dark-default')
    $wrapper.addClass('Night')
  } else {
    setTheme(themeType)
    $wrapper.removeClass('Night')
  }

  loadIcons()
}

void (async () => {
  const runEnv = getRunEnv()

  const storage = await getStorage()
  const options = storage[StorageKey.Options]

  if (options.theme.mode === 'compact') {
    $body.addClass('v2p-mode-compact')
  }

  const $toggle = $('#Rightbar .light-toggle').addClass('v2p-color-mode-toggle')

  const themeType = options.theme.type || 'light-default'

  // 处理自动切换「明/暗」主题。
  if (options.theme.autoSwitch) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
    const isPrefersDark = prefersDark.matches

    toggleTheme({
      $toggle,
      prefersDark: isPrefersDark,
      themeType: isPrefersDark ? 'dark-default' : themeType,
    })

    prefersDark.addEventListener('change', ({ matches }) => {
      toggleTheme({
        $toggle,
        prefersDark: matches,
        themeType: matches ? 'dark-default' : themeType,
      })
    })
  } else {
    /**
     * 在浏览器扩展中，使用 themeType 判断是否为暗色主题。
     * 而在 GreaseMonkey 中，使用 $wrapper.hasClass('Night') 判断是否为暗色主题。
     */
    const prefersDark = runEnv ? themeType === 'dark-default' : $wrapper.hasClass('Night')
    toggleTheme({ $toggle, prefersDark, themeType })
  }

  $toggle.on('click', () => {
    const wrapperDark = $wrapper.hasClass('Night')

    const newTheme: Partial<Options['theme']> = {
      type: wrapperDark ? 'light-default' : 'dark-default',
      autoSwitch: false, // 当用户主动设置颜色主题后，取消自动跟随系统。
    }

    void setStorage(StorageKey.Options, deepMerge(options, { theme: newTheme }))
  })

  const syncInfo = storage[StorageKey.SyncInfo]

  // 当发现远程的配置有更新时，自动同步到本地。
  if (syncInfo) {
    const lastCheckTime = syncInfo.lastCheckTime
    const twoHours = 2 * 60 * 1000 * 60
    const neverChecked = !lastCheckTime

    if ((lastCheckTime && Date.now() - lastCheckTime >= twoHours) || neverChecked) {
      const isSignInPage = window.location.href.includes('/signin')

      // Warning: 不能在登录页请求 getV2P_Settings 接口，否则会导致无法成功跳转页面。
      if (!isSignInPage) {
        void getV2P_Settings().then(async (res) => {
          const settings = res?.config
          const remoteSyncInfo = settings?.[StorageKey.SyncInfo]

          if (settings && remoteSyncInfo) {
            if (syncInfo.version < remoteSyncInfo.version || neverChecked) {
              await chrome.storage.sync.set(
                deepMerge(storage, {
                  ...settings,
                  [StorageKey.SyncInfo]: {
                    ...settings[StorageKey.SyncInfo],
                    lastCheckTime: Date.now(),
                  },
                })
              )
            }
          }
        })
      }
    }
  }

  // 更换主题颜色切换的按钮。
  {
    const $toggleImg = $toggle.find('> img')
    const alt = $toggleImg.prop('alt')

    if (alt === 'Light') {
      $toggle.prop('title', '使用深色主题')
      $toggleImg.replaceWith('<i data-lucide="moon"></i>')
    } else if (alt === 'Dark') {
      $toggle.prop('title', '使用浅色主题')
      $toggleImg.replaceWith('<i data-lucide="sun"></i>')
    }
  }

  // 为顶部导航栏的按钮添加 hover 效果。
  {
    $('#Top .site-nav .tools > .top').addClass('v2p-hover-btn')
  }

  // 增加 SOV2EX 作为搜索引擎选项。
  // MARK: @deprecated: V2EX 原站已支持 SOV2EX，故不再需要此功能。
  // {
  //   const $searchItem = $('<a class="search-item cell" target="_blank">')

  //   $searchItem
  //     .on('mouseover', () => {
  //       $('#search-result .search-item.active').addClass('v2p-no-active')
  //       $searchItem.addClass('active')
  //     })
  //     .on('mouseleave', () => {
  //       $('#search-result .search-item.active').removeClass('v2p-no-active')
  //       $searchItem.removeClass('active')
  //     })

  //   const $search = $('#search')

  //   $search.on('input', (ev) => {
  //     const value = (ev.target as HTMLInputElement).value
  //     const $searchGroup = $('#search-result .search-item-group:last-of-type')
  //     $searchItem.text(`SOV2EX ${value}`).prop('href', `https://www.sov2ex.com/?q=${value}`)
  //     $searchGroup.append($searchItem)
  //   })
  // }

  if (options.hideAccount) {
    const faviconLink = $("link[rel~='icon']")
    faviconLink.prop('href', 'https://v2p.app/favicon.svg')

    $('#Logo').css('opacity', '0')
    $('#Top').find('a[href^="/member/"]').remove()
    $infoCard
      .find('a[href^="/member/"], table:nth-of-type(1) td:nth-of-type(3) .fade')
      .addClass('v2p-hide-account')
  }

  if (runEnv === 'chrome' || runEnv === 'web-ext') {
    injectScript(chrome.runtime.getURL('scripts/web_accessible_resources.min.js'))

    window.addEventListener('message', (ev: MessageEvent<MessageData>) => {
      if (ev.data.from === MessageFrom.Web) {
        const payload = ev.data.payload
        const task = payload?.task

        if (payload?.status === 'ready') {
          postTask('if (typeof window.once === "string") { return window.once; }', (result) => {
            if (typeof result === 'string') {
              window.once = result
            }
          })
        }

        if (task) {
          window.__V2P_Tasks?.get(task.id)?.(task.result)
        }
      }
    })
  }

  // 添加页面底部相关信息。
  {
    const $extraFooter = $(`
    <div class="v2p-footer">
      <div class="v2p-footer-text">扩展自 V2EX Polish </div>

      <div class="v2p-footer-links">
        <a class="v2p-footer-link v2p-hover-btn" href="${Links.Home}" target="_blank">插件官网</a>
        <a class="v2p-footer-link v2p-hover-btn" href="${Links.Feedback}" target="_blank">问题反馈</a>
        <a class="v2p-footer-link v2p-hover-btn" href="${Links.Support}" target="_blank">赞赏支持</a>
        <a class="v2p-footer-link v2p-hover-btn v2p-optbtn" href="javascript:void(0);">选项设置</a>
      </div>

      <div class="v2p-footer-brand">
        <span>
          <a
            href="https://github.com/coolpace/V2EX_Polish"
            target="_blank"
            title="GitHub 仓库"
          >
            ${iconGitHub}
          </a>
        </span>
      </div>
    </div>
    `)

    $extraFooter.find('.v2p-optbtn').on('click', () => {
      chrome.runtime.sendMessage({ [MessageKey.showOptions]: true })
    })

    $(`<div class="v2p-footer-logo">${iconLogo}</div>`).prependTo($extraFooter)

    $('#Bottom .content').append($extraFooter)
  }
})()
