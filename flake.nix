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
                exec zsh
              fi
            '';
          };
        });
    };
}
