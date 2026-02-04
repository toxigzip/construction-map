# Инструкция по настройке Git и GitHub

Похоже, что Git не установлен на вашем компьютере. Вот пошаговая инструкция, как все настроить.

## 1. Установка Git
1. Скачайте Git для Windows: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Установите его, используя настройки по умолчанию.
3. **Важно:** После установки перезапустите VS Code, чтобы терминал распознал команду `git`.

## 2. Инициализация проекта
После установки откройте терминал в папке проекта (`Ctrl+~` в VS Code) и выполните команды по очереди:

```powershell
# 1. Инициализация
git init

# 2. Добавление файлов (я уже создал .gitignore)
git add .

# 3. Создание первого коммита
git commit -m "Initial commit: Project structure and basic map implementation"
```

## 3. Загрузка на GitHub
1. Перейдите на [github.com/new](https://github.com/new).
2. Создайте репозиторий (например, `construction-map`).
   - **Не** ставьте галочки "Add a README file", ".gitignore", "license".
3. Скопируйте команды из раздела **"…or push an existing repository from the command line"**.
4. Выполните их в терминале:

```powershell
git branch -M main
git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/construction-map.git
git push -u origin main
```

После этого ваш проект будет загружен в облако!
