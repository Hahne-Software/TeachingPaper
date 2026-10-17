{
  description = "TeachingPaper – Tauri desktop app dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system:
        f (import nixpkgs {
          inherit system;
          config.allowUnfree = true; # claude-code is unfree
        }));
    in
    {
      devShells = forAll (pkgs:
        let
          inherit (pkgs) lib stdenv;

          # Tauri v2 Linux build dependencies
          linuxLibs = with pkgs; [
            webkitgtk_4_1
            gtk3
            libsoup_3
            glib
            cairo
            pango
            gdk-pixbuf
            atk
            librsvg
            openssl
            libayatana-appindicator
          ];

          # Throw-away ZDOTDIR that loads the user's real zsh config untouched
          # (with ZDOTDIR pointing at it) and then puts a marker at the front of
          # $PROMPT. The marker hook re-registers itself last in precmd so
          # prompt themes can't drop it.
          zdotdir = pkgs.symlinkJoin {
            name = "devshell-zdotdir";
            paths = [
              (pkgs.writeTextDir ".zshenv" ''
                _devshell_zdotdir=$ZDOTDIR
                ZDOTDIR=''${NIX_DEVSHELL_USER_ZDOTDIR:-$HOME}
                [[ -f $ZDOTDIR/.zshenv ]] && source $ZDOTDIR/.zshenv
                ZDOTDIR=$_devshell_zdotdir
              '')
              (pkgs.writeTextDir ".zshrc" ''
                ZDOTDIR=''${NIX_DEVSHELL_USER_ZDOTDIR:-$HOME}
                unset NIX_DEVSHELL_USER_ZDOTDIR _devshell_zdotdir
                [[ -f $ZDOTDIR/.zshrc ]] && source $ZDOTDIR/.zshrc

                _devshell_marker() {
                  precmd_functions=(''${precmd_functions:#_devshell_marker} _devshell_marker)
                  local m='%B%F{yellow}[TeachingPaper]%f%b '
                  [[ $PROMPT == "$m"* ]] || PROMPT="$m$PROMPT"
                }
                precmd_functions+=(_devshell_marker)
              '')
            ];
          };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              # shell
              zsh

              # JS toolchain
              nodejs
              pnpm

              # Rust toolchain
              cargo
              rustc
              rustfmt
              clippy
              rust-analyzer

              # Tauri tooling
              cargo-tauri

              # AI / agent tooling
              claude-code
              pi-coding-agent
              rtk

              # Git hosting
              gh
            ] ++ lib.optionals stdenv.isLinux ([ pkgs.pkg-config pkgs.wrapGAppsHook3 ] ++ linuxLibs);

            RUST_SRC_PATH = "${pkgs.rustPlatform.rustLibSrc}";

            shellHook = ''
              ${lib.optionalString stdenv.isLinux ''
                export LD_LIBRARY_PATH="${lib.makeLibraryPath linuxLibs}:$LD_LIBRARY_PATH"
                export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
              ''}

              # Drop into zsh for interactive sessions
              if [ -z "$ZSH_VERSION" ] && [ -t 0 ] && [ -z "$IN_NIX_DEVSHELL_ZSH" ]; then
                export IN_NIX_DEVSHELL_ZSH=1
                NIX_DEVSHELL_USER_ZDOTDIR="''${ZDOTDIR:-$HOME}" ZDOTDIR=${zdotdir} exec zsh
              fi
            '';
          };
        });
    };
}
